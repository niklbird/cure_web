//! "Verify object": checks what can be checked about the loaded object.
//!
//! Without a chain only self-contained properties are checked (structure, content
//! digests, the CMS signature against the embedded EE certificate, self-signatures,
//! validity periods, RFC 3779 payload containment). With a chain (certificates and,
//! optionally, CRLs) the issuer path is built and validated up to the top of the chain.
//!
//! The object is read through the cure_asn1 `Tree`, so every check can point at the
//! node it is about. Chain items are parsed with the same parser.

use cure_asn1::tree_parser::Tree;
use serde::Serialize;
use sha1::Sha1;
use sha2_10::{Digest, Sha256, Sha384, Sha512};
use std::collections::HashSet;

// ─── Tree view ────────────────────────────────────────────────────────────────

/// A read-only snapshot of one ASN.1 element as it would be exported.
#[derive(Clone, Debug)]
struct N {
    /// Node id in the editor tree (None for chain items and re-parsed content).
    id: Option<usize>,
    tag: u8,
    raw: Vec<u8>,
    content: Vec<u8>,
    kids: Vec<N>,
}

type R<T> = Result<T, String>;

fn snapshot(tree: &Tree, id: usize, with_ids: bool) -> R<N> {
    let tok = tree.get_node(id).ok_or_else(|| format!("Node {} missing", id))?;
    let mut kids = Vec::with_capacity(tok.children.len());
    for k in &tok.children {
        kids.push(snapshot(tree, *k, with_ids)?);
    }
    Ok(N {
        id: if with_ids { Some(id) } else { None },
        tag: tok.tag_u,
        raw: tree.encode_node(tok),
        content: tree.encode_node_content(tok, true),
        kids,
    })
}

fn parse_bytes(data: &[u8]) -> R<N> {
    if data.is_empty() {
        return Err("Empty data".into());
    }
    let tree = cure_asn1::parse_tree(&data.to_vec(), "").ok_or("Could not parse ASN.1")?;
    if tree.tokens.is_empty() {
        return Err("Could not parse ASN.1".into());
    }
    snapshot(&tree, tree.root_id, false)
}

const SEQ: u8 = 0x30;
const SET: u8 = 0x31;
const INT: u8 = 0x02;
const BITS: u8 = 0x03;
const OCTETS: u8 = 0x04;
const NULL: u8 = 0x05;
const OIDT: u8 = 0x06;
const BOOL: u8 = 0x01;
const UTC: u8 = 0x17;
const GEN: u8 = 0x18;

impl N {
    fn kid(&self, i: usize, what: &str) -> R<&N> {
        self.kids.get(i).ok_or_else(|| format!("{} is missing", what))
    }
    fn expect(&self, tag: u8, what: &str) -> R<&N> {
        if self.tag != tag {
            return Err(format!("{}: expected tag 0x{:02x}, found 0x{:02x}", what, tag, self.tag));
        }
        Ok(self)
    }
    fn is_ctx(&self, num: u8) -> bool {
        self.tag & 0xc0 == 0x80 && self.tag & 0x1f == num
    }
    /// DER content of an OCTET/BIT STRING wrapper, using the parsed child when the tree has one.
    fn inner(&self) -> R<N> {
        let body: &[u8] = if self.tag == BITS && !self.content.is_empty() { &self.content[1..] } else { &self.content };
        if self.kids.len() == 1 && self.kids[0].raw == body {
            return Ok(self.kids[0].clone());
        }
        parse_bytes(body)
    }
    fn oid(&self) -> R<String> {
        self.expect(OIDT, "OID")?;
        decode_oid(&self.content)
    }
    fn int(&self) -> R<i128> {
        self.expect(INT, "INTEGER")?;
        let c = &self.content;
        if c.is_empty() || c.len() > 16 {
            return Err("INTEGER out of range".into());
        }
        let mut v: i128 = if c[0] & 0x80 != 0 { -1 } else { 0 };
        for b in c {
            v = (v << 8) | *b as i128;
        }
        Ok(v)
    }
    fn bits(&self) -> R<(u8, &[u8])> {
        self.expect(BITS, "BIT STRING")?;
        if self.content.is_empty() {
            return Err("Empty BIT STRING".into());
        }
        Ok((self.content[0], &self.content[1..]))
    }
    fn is_time(&self) -> bool {
        self.tag == UTC || self.tag == GEN
    }
    fn time(&self) -> R<i64> {
        decode_time(self.tag, &self.content)
    }
    fn string(&self) -> String {
        if self.tag == 0x1e {
            let u: Vec<u16> = self.content.chunks(2).filter(|c| c.len() == 2).map(|c| u16::from_be_bytes([c[0], c[1]])).collect();
            return String::from_utf16_lossy(&u);
        }
        String::from_utf8_lossy(&self.content).into_owned()
    }
}

fn decode_oid(c: &[u8]) -> R<String> {
    if c.is_empty() {
        return Err("Empty OID".into());
    }
    let mut arcs: Vec<u128> = vec![];
    let mut v: u128 = 0;
    for b in c {
        v = (v << 7) | (*b & 0x7f) as u128;
        if b & 0x80 == 0 {
            arcs.push(v);
            v = 0;
        }
    }
    let first = arcs[0];
    let mut out = if first < 40 { vec![0, first] } else if first < 80 { vec![1, first - 40] } else { vec![2, first - 80] };
    out.extend_from_slice(&arcs[1..]);
    Ok(out.iter().map(|a| a.to_string()).collect::<Vec<_>>().join("."))
}

fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe - 719468
}

/// Time → milliseconds since the epoch.
fn decode_time(tag: u8, c: &[u8]) -> R<i64> {
    let s = String::from_utf8_lossy(c);
    let s = s.as_ref();
    let bad = || format!("Invalid time \"{}\"", s);
    if !s.ends_with('Z') {
        return Err(bad());
    }
    let body = &s[..s.len() - 1];
    let (date, frac) = match body.find(|ch| ch == '.' || ch == ',') {
        Some(i) => (&body[..i], &body[i + 1..]),
        None => (body, ""),
    };
    if !date.chars().all(|ch| ch.is_ascii_digit()) || !frac.chars().all(|ch| ch.is_ascii_digit()) {
        return Err(bad());
    }
    let num = |a: usize, b: usize| -> R<i64> { date.get(a..b).ok_or_else(bad)?.parse::<i64>().map_err(|_| bad()) };
    let (year, rest) = if tag == UTC {
        let yy = num(0, 2)?;
        (if yy < 50 { 2000 + yy } else { 1900 + yy }, 2)
    } else {
        (num(0, 4)?, 4)
    };
    let month = num(rest, rest + 2)?;
    let day = num(rest + 2, rest + 4)?;
    let hour = num(rest + 4, rest + 6)?;
    let min = if date.len() >= rest + 8 { num(rest + 6, rest + 8)? } else { 0 };
    let sec = if date.len() >= rest + 10 { num(rest + 8, rest + 10)? } else { 0 };
    if date.len() != rest + 6 && date.len() != rest + 8 && date.len() != rest + 10 {
        return Err(bad());
    }
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) || hour > 23 || min > 59 || sec > 60 {
        return Err(bad());
    }
    let ms = if frac.is_empty() { 0 } else { format!("{:0<3}", &frac[..frac.len().min(3)]).parse::<i64>().unwrap_or(0) };
    Ok((days_from_civil(year, month, day) * 86400 + hour * 3600 + min * 60 + sec) * 1000 + ms)
}

fn fmt_time(ms: i64) -> String {
    let secs = ms.div_euclid(1000);
    match chrono::DateTime::from_timestamp(secs, 0) {
        Some(d) => d.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        None => "invalid date".into(),
    }
}

fn hexs(b: &[u8]) -> String {
    hex::encode(b)
}

/// INTEGER content without redundant leading zero bytes, for serial comparison.
fn norm_int(c: &[u8]) -> &[u8] {
    let mut c = c;
    while c.len() > 1 && c[0] == 0 && c[1] & 0x80 == 0 {
        c = &c[1..];
    }
    c
}

// ─── OIDs and algorithms ──────────────────────────────────────────────────────

const OID_SIGNED_DATA: &str = "1.2.840.113549.1.7.2";
const OID_CT_ATTR: &str = "1.2.840.113549.1.9.3";
const OID_MD_ATTR: &str = "1.2.840.113549.1.9.4";
const OID_ST_ATTR: &str = "1.2.840.113549.1.9.5";
const OID_BST_ATTR: &str = "1.2.840.113549.1.9.16.2.46";
const OID_RSA: &str = "1.2.840.113549.1.1.1";
const OID_SHA256_RSA: &str = "1.2.840.113549.1.1.11";
const OID_EC: &str = "1.2.840.10045.2.1";
const OID_SHA256: &str = "2.16.840.1.101.3.4.2.1";
const OID_SKI: &str = "2.5.29.14";
const OID_KU: &str = "2.5.29.15";
const OID_BC: &str = "2.5.29.19";
const OID_CRLNUM: &str = "2.5.29.20";
const OID_AKI: &str = "2.5.29.35";
const OID_IP: &str = "1.3.6.1.5.5.7.1.7";
const OID_AS: &str = "1.3.6.1.5.5.7.1.8";
const OID_IP2: &str = "1.3.6.1.5.5.7.1.28";
const OID_AS2: &str = "1.3.6.1.5.5.7.1.29";
const OID_ROA: &str = "1.2.840.113549.1.9.16.1.24";
const OID_MFT: &str = "1.2.840.113549.1.9.16.1.26";
const OID_ASPA: &str = "1.2.840.113549.1.9.16.1.49";

fn content_type_name(oid: &str) -> Option<&'static str> {
    Some(match oid {
        OID_ROA => "ROA",
        OID_MFT => "Manifest",
        "1.2.840.113549.1.9.16.1.35" => "Ghostbusters record",
        "1.2.840.113549.1.9.16.1.48" => "Signed checklist (RSC)",
        OID_ASPA => "ASPA",
        "1.2.840.113549.1.9.16.1.50" => "Trust anchor key (TAK)",
        "1.2.840.113549.1.9.16.1.47" => "Geofeed",
        "1.2.840.113549.1.7.1" => "data",
        _ => return None,
    })
}

#[derive(Clone, Copy, PartialEq, Debug)]
enum Hash {
    Sha1,
    Sha256,
    Sha384,
    Sha512,
}

impl Hash {
    fn name(&self) -> &'static str {
        match self {
            Hash::Sha1 => "SHA-1",
            Hash::Sha256 => "SHA-256",
            Hash::Sha384 => "SHA-384",
            Hash::Sha512 => "SHA-512",
        }
    }
    fn digest(&self, data: &[u8]) -> Vec<u8> {
        match self {
            Hash::Sha1 => Sha1::digest(data).to_vec(),
            Hash::Sha256 => Sha256::digest(data).to_vec(),
            Hash::Sha384 => Sha384::digest(data).to_vec(),
            Hash::Sha512 => Sha512::digest(data).to_vec(),
        }
    }
}

fn digest_alg(oid: &str) -> Option<Hash> {
    match oid {
        "1.3.14.3.2.26" => Some(Hash::Sha1),
        "2.16.840.1.101.3.4.2.1" => Some(Hash::Sha256),
        "2.16.840.1.101.3.4.2.2" => Some(Hash::Sha384),
        "2.16.840.1.101.3.4.2.3" => Some(Hash::Sha512),
        _ => None,
    }
}

#[derive(Clone, Copy, PartialEq)]
enum SigKind {
    Rsa,
    Ecdsa,
}

fn sig_alg(oid: &str) -> Option<(SigKind, Option<Hash>, &'static str)> {
    Some(match oid {
        OID_RSA => (SigKind::Rsa, None, "rsaEncryption"),
        "1.2.840.113549.1.1.5" => (SigKind::Rsa, Some(Hash::Sha1), "sha1WithRSAEncryption"),
        OID_SHA256_RSA => (SigKind::Rsa, Some(Hash::Sha256), "sha256WithRSAEncryption"),
        "1.2.840.113549.1.1.12" => (SigKind::Rsa, Some(Hash::Sha384), "sha384WithRSAEncryption"),
        "1.2.840.113549.1.1.13" => (SigKind::Rsa, Some(Hash::Sha512), "sha512WithRSAEncryption"),
        "1.2.840.10045.4.1" => (SigKind::Ecdsa, Some(Hash::Sha1), "ecdsa-with-SHA1"),
        "1.2.840.10045.4.3.2" => (SigKind::Ecdsa, Some(Hash::Sha256), "ecdsa-with-SHA256"),
        "1.2.840.10045.4.3.3" => (SigKind::Ecdsa, Some(Hash::Sha384), "ecdsa-with-SHA384"),
        "1.2.840.10045.4.3.4" => (SigKind::Ecdsa, Some(Hash::Sha512), "ecdsa-with-SHA512"),
        _ => return None,
    })
}

fn sig_name(oid: &str) -> String {
    sig_alg(oid).map(|s| s.2.to_string()).unwrap_or_else(|| oid.to_string())
}

#[derive(Clone)]
struct PublicKey {
    spki: Vec<u8>,
    alg: String,
    curve: Option<String>,
    key_bits: Vec<u8>,
}

enum SigError {
    Unsupported(String),
    Other(String),
}

fn verify_sig(key: &PublicKey, alg_oid: &str, data: &[u8], sig: &[u8], hash_override: Option<Hash>) -> Result<bool, SigError> {
    use rsa::pkcs8::DecodePublicKey;
    let (kind, hash, name) = sig_alg(alg_oid).ok_or_else(|| SigError::Unsupported(format!("Signature algorithm {} is not supported", alg_oid)))?;
    let hash = hash.or(hash_override).ok_or_else(|| SigError::Unsupported("No hash algorithm for the signature".into()))?;
    let hashed = hash.digest(data);
    match kind {
        SigKind::Rsa => {
            if key.alg != OID_RSA {
                return Err(SigError::Other(format!("{} signature but the key is not an RSA key", name)));
            }
            let pk = rsa::RsaPublicKey::from_public_key_der(&key.spki).map_err(|e| SigError::Other(format!("Invalid RSA key: {}", e)))?;
            let scheme = match hash {
                Hash::Sha1 => rsa::Pkcs1v15Sign::new::<Sha1>(),
                Hash::Sha256 => rsa::Pkcs1v15Sign::new::<Sha256>(),
                Hash::Sha384 => rsa::Pkcs1v15Sign::new::<Sha384>(),
                Hash::Sha512 => rsa::Pkcs1v15Sign::new::<Sha512>(),
            };
            Ok(pk.verify(scheme, &hashed, sig).is_ok())
        }
        SigKind::Ecdsa => {
            use p256::ecdsa::signature::hazmat::PrehashVerifier;
            if key.alg != OID_EC {
                return Err(SigError::Other(format!("{} signature but the key is not an EC key", name)));
            }
            match key.curve.as_deref() {
                Some("1.2.840.10045.3.1.7") => {
                    let vk = p256::ecdsa::VerifyingKey::from_public_key_der(&key.spki).map_err(|e| SigError::Other(format!("Invalid P-256 key: {}", e)))?;
                    let s = p256::ecdsa::Signature::from_der(sig).map_err(|e| SigError::Other(format!("Malformed ECDSA signature: {}", e)))?;
                    Ok(vk.verify_prehash(&hashed, &s).is_ok())
                }
                Some("1.3.132.0.34") => {
                    let vk = p384::ecdsa::VerifyingKey::from_public_key_der(&key.spki).map_err(|e| SigError::Other(format!("Invalid P-384 key: {}", e)))?;
                    let s = p384::ecdsa::Signature::from_der(sig).map_err(|e| SigError::Other(format!("Malformed ECDSA signature: {}", e)))?;
                    Ok(vk.verify_prehash(&hashed, &s).is_ok())
                }
                other => Err(SigError::Unsupported(format!("EC curve {} is not supported", other.unwrap_or("(none)")))),
            }
        }
    }
}

// ─── RFC 3779 resources ───────────────────────────────────────────────────────

type Range = (u128, u128);

#[derive(Clone, Debug, PartialEq)]
enum RList {
    None,
    Inherit,
    Ranges(Vec<Range>),
}

#[derive(Clone, Debug)]
struct Resources {
    v4: RList,
    v6: RList,
    asn: RList,
}

#[derive(Clone, Copy, PartialEq)]
enum RKind {
    V4,
    V6,
    As,
}

const RKINDS: [RKind; 3] = [RKind::V4, RKind::V6, RKind::As];

impl RKind {
    fn name(&self) -> &'static str {
        match self {
            RKind::V4 => "IPv4",
            RKind::V6 => "IPv6",
            RKind::As => "AS",
        }
    }
    fn width(&self) -> u32 {
        match self {
            RKind::V4 => 32,
            _ => 128,
        }
    }
}

impl Resources {
    fn empty() -> Self {
        Resources { v4: RList::None, v6: RList::None, asn: RList::None }
    }
    fn get(&self, k: RKind) -> &RList {
        match k {
            RKind::V4 => &self.v4,
            RKind::V6 => &self.v6,
            RKind::As => &self.asn,
        }
    }
    fn set(&mut self, k: RKind, v: RList) {
        match k {
            RKind::V4 => self.v4 = v,
            RKind::V6 => self.v6 = v,
            RKind::As => self.asn = v,
        }
    }
    fn has_any(&self) -> bool {
        RKINDS.iter().any(|k| *self.get(*k) != RList::None)
    }
    fn has_inherit(&self) -> bool {
        RKINDS.iter().any(|k| *self.get(*k) == RList::Inherit)
    }
}

/// Address prefix BIT STRING → (value with missing bits set to `fill`, prefix length)
fn bits_to_addr(n: &N, width: u32, fill: bool) -> R<(u128, u32)> {
    let (unused, bytes) = n.bits()?;
    let len = (bytes.len() as u32 * 8).checked_sub(unused as u32).ok_or("Invalid BIT STRING")?;
    if len > width || bytes.len() > 16 {
        return Err(format!("Address prefix longer than {} bits", width));
    }
    let mut v: u128 = 0;
    for b in bytes {
        v = (v << 8) | *b as u128;
    }
    v >>= unused;
    let rest = width - len;
    let v = if rest == 0 { v } else if rest == 128 { 0 } else { v << rest };
    let ones = if rest == 0 { 0 } else if rest == 128 { u128::MAX } else { (1u128 << rest) - 1 };
    let v = if fill { v | ones } else { v };
    let v = if width == 32 { v & 0xffff_ffff } else { v };
    Ok((v, len))
}

fn parse_ip_blocks(ext: &N, res: &mut Resources) -> R<()> {
    for fam in &ext.expect(SEQ, "IPAddrBlocks")?.kids {
        let afi = &fam.kid(0, "addressFamily")?.expect(OCTETS, "addressFamily")?.content;
        let kind = match afi.get(0..2) {
            Some([0, 1]) => RKind::V4,
            Some([0, 2]) => RKind::V6,
            _ => continue,
        };
        let choice = fam.kid(1, "ipAddressChoice")?;
        if choice.tag == NULL {
            res.set(kind, RList::Inherit);
            continue;
        }
        let mut ranges = vec![];
        for item in &choice.expect(SEQ, "addressesOrRanges")?.kids {
            if item.tag == BITS {
                ranges.push((bits_to_addr(item, kind.width(), false)?.0, bits_to_addr(item, kind.width(), true)?.0));
            } else {
                let r = item.expect(SEQ, "IPAddressRange")?;
                ranges.push((bits_to_addr(r.kid(0, "min")?, kind.width(), false)?.0, bits_to_addr(r.kid(1, "max")?, kind.width(), true)?.0));
            }
        }
        res.set(kind, RList::Ranges(ranges));
    }
    Ok(())
}

fn parse_as_ids(ext: &N) -> R<RList> {
    let asnum = match ext.expect(SEQ, "ASIdentifiers")?.kids.iter().find(|k| k.is_ctx(0)) {
        Some(a) => a,
        None => return Ok(RList::None),
    };
    let choice = asnum.kid(0, "asnum")?;
    if choice.tag == NULL {
        return Ok(RList::Inherit);
    }
    let mut ranges = vec![];
    for item in &choice.expect(SEQ, "asIdsOrRanges")?.kids {
        if item.tag == INT {
            let v = item.int()? as u128;
            ranges.push((v, v));
        } else {
            ranges.push((item.kid(0, "min")?.int()? as u128, item.kid(1, "max")?.int()? as u128));
        }
    }
    Ok(RList::Ranges(ranges))
}

/// Returns the first range of `inner` not covered by the union of `outer`.
fn ranges_contained(inner: &[Range], outer: &[Range]) -> Option<Range> {
    let mut merged: Vec<Range> = outer.to_vec();
    merged.sort();
    let mut union: Vec<Range> = vec![];
    for r in merged {
        if let Some(last) = union.last_mut() {
            if last.1 == u128::MAX || r.0 <= last.1 + 1 {
                if r.1 > last.1 {
                    last.1 = r.1;
                }
                continue;
            }
        }
        union.push(r);
    }
    inner.iter().find(|r| !union.iter().any(|u| u.0 <= r.0 && r.1 <= u.1)).copied()
}

fn fmt_range(r: Range, k: RKind) -> String {
    if k == RKind::As {
        return if r.0 == r.1 { format!("AS{}", r.0) } else { format!("AS{}-AS{}", r.0, r.1) };
    }
    let fmt = |v: u128| -> String {
        if k == RKind::V4 {
            std::net::Ipv4Addr::from(v as u32).to_string()
        } else {
            std::net::Ipv6Addr::from(v).to_string()
        }
    };
    let width = k.width();
    let size = r.1.wrapping_sub(r.0).wrapping_add(1);
    if size == 0 && r.0 == 0 && width == 128 {
        return format!("{}/0", fmt(0));
    }
    if size != 0 && size.is_power_of_two() && r.0 & (size - 1) == 0 {
        let plen = width - size.trailing_zeros();
        return format!("{}/{}", fmt(r.0), plen);
    }
    format!("{}-{}", fmt(r.0), fmt(r.1))
}

fn describe_resources(res: &Resources) -> String {
    let mut parts = vec![];
    for k in RKINDS {
        match res.get(k) {
            RList::None => {}
            RList::Inherit => parts.push(format!("{}: inherit", k.name())),
            RList::Ranges(v) => {
                let mut s = v.iter().take(4).map(|r| fmt_range(*r, k)).collect::<Vec<_>>().join(", ");
                if v.len() > 4 {
                    s += &format!(" (+{} more)", v.len() - 4);
                }
                parts.push(format!("{}: {}", k.name(), s));
            }
        }
    }
    if parts.is_empty() { "none".into() } else { parts.join("; ") }
}

// ─── Certificates, CRLs, CSRs ─────────────────────────────────────────────────

#[derive(Clone)]
struct Cert {
    node: Option<usize>,
    validity_node: Option<usize>,
    ext_node: Option<usize>,
    tbs: Vec<u8>,
    sig_alg: String,
    signature: Vec<u8>,
    version: i128,
    serial: Vec<u8>,
    issuer: Vec<u8>,
    subject: Vec<u8>,
    subject_name: String,
    not_before: i64,
    not_after: i64,
    key: PublicKey,
    ski: Option<Vec<u8>>,
    aki: Option<Vec<u8>>,
    is_ca: Option<bool>,
    key_usage: Option<HashSet<u32>>,
    resources: Resources,
}

const KU_DIGITAL_SIGNATURE: u32 = 0;
const KU_KEY_CERT_SIGN: u32 = 5;
const KU_CRL_SIGN: u32 = 6;

fn alg_oid(n: &N, what: &str) -> R<String> {
    n.expect(SEQ, what)?.kid(0, what)?.oid()
}

fn name_attr(oid: &str) -> &str {
    match oid {
        "2.5.4.3" => "CN",
        "2.5.4.5" => "serialNumber",
        "2.5.4.6" => "C",
        "2.5.4.7" => "L",
        "2.5.4.8" => "ST",
        "2.5.4.10" => "O",
        "2.5.4.11" => "OU",
        "1.2.840.113549.1.9.1" => "emailAddress",
        o => o,
    }
}

fn format_name(n: &N) -> String {
    let mut parts = vec![];
    for rdn in &n.kids {
        for atv in &rdn.kids {
            if atv.kids.len() < 2 {
                continue;
            }
            let oid = atv.kids[0].oid().unwrap_or_default();
            parts.push(format!("{}={}", name_attr(&oid), atv.kids[1].string()));
        }
    }
    if parts.is_empty() { "(empty name)".into() } else { parts.join(", ") }
}

fn parse_spki(n: &N) -> R<PublicKey> {
    let s = n.expect(SEQ, "SubjectPublicKeyInfo")?;
    let alg = s.kid(0, "SPKI algorithm")?.expect(SEQ, "SPKI algorithm")?;
    let alg_oid = alg.kid(0, "SPKI algorithm")?.oid()?;
    let curve = alg.kids.get(1).filter(|p| p.tag == OIDT).and_then(|p| p.oid().ok());
    let (_, bits) = s.kid(1, "subjectPublicKey")?.bits()?;
    Ok(PublicKey { spki: s.raw.clone(), alg: alg_oid, curve, key_bits: bits.to_vec() })
}

struct Ext {
    value: N,
}

fn parse_extensions(wrapper: Option<&N>) -> R<Vec<(String, Ext)>> {
    let mut out = vec![];
    let w = match wrapper {
        Some(w) => w,
        None => return Ok(out),
    };
    for e in &w.kid(0, "Extensions")?.expect(SEQ, "Extensions")?.kids {
        let oid = e.kid(0, "extnID")?.oid()?;
        let val = e.kids.last().ok_or("extnValue missing")?.expect(OCTETS, "extnValue")?;
        let inner = val.inner().map_err(|err| format!("extension {}: {}", oid, err))?;
        out.push((oid, Ext { value: inner }));
    }
    Ok(out)
}

fn parse_aki(v: &N) -> Option<Vec<u8>> {
    v.kids.iter().find(|k| k.is_ctx(0)).map(|k| k.content.clone())
}

fn parse_cert(n: &N) -> R<Cert> {
    let cert = n.expect(SEQ, "Certificate")?;
    let tbs = cert.kid(0, "tbsCertificate")?.expect(SEQ, "tbsCertificate")?;
    let sig_alg = alg_oid(cert.kid(1, "signatureAlgorithm")?, "signatureAlgorithm")?;
    let (_, sig) = cert.kid(2, "signatureValue")?.bits()?;
    let f = &tbs.kids;
    let mut i = 0;
    let mut version = 1;
    if f.get(0).map(|k| k.is_ctx(0)).unwrap_or(false) {
        version = f[0].kid(0, "version")?.int()? + 1;
        i += 1;
    }
    let serial = norm_int(&tbs.kid(i, "serialNumber")?.expect(INT, "serialNumber")?.content).to_vec();
    i += 1;
    alg_oid(tbs.kid(i, "signature")?, "tbsCertificate signature")?;
    i += 1;
    let issuer = tbs.kid(i, "issuer")?.expect(SEQ, "issuer")?;
    i += 1;
    let validity = tbs.kid(i, "validity")?.expect(SEQ, "validity")?;
    i += 1;
    let subject = tbs.kid(i, "subject")?.expect(SEQ, "subject")?;
    i += 1;
    let key = parse_spki(tbs.kid(i, "subjectPublicKeyInfo")?)?;
    i += 1;
    let ext_wrapper = f[i.min(f.len())..].iter().find(|k| k.is_ctx(3));
    let exts = parse_extensions(ext_wrapper)?;

    let mut c = Cert {
        node: cert.id,
        validity_node: validity.id,
        ext_node: ext_wrapper.and_then(|w| w.id),
        tbs: tbs.raw.clone(),
        sig_alg,
        signature: sig.to_vec(),
        version,
        serial,
        issuer: issuer.raw.clone(),
        subject: subject.raw.clone(),
        subject_name: format_name(subject),
        not_before: validity.kid(0, "notBefore")?.time()?,
        not_after: validity.kid(1, "notAfter")?.time()?,
        key,
        ski: None,
        aki: None,
        is_ca: None,
        key_usage: None,
        resources: Resources::empty(),
    };
    for (oid, e) in &exts {
        match oid.as_str() {
            OID_SKI => c.ski = Some(e.value.expect(OCTETS, "SubjectKeyIdentifier")?.content.clone()),
            OID_AKI => c.aki = parse_aki(&e.value),
            OID_BC => {
                c.is_ca = Some(e.value.kids.get(0).map(|b| b.tag == BOOL && b.content.first().copied().unwrap_or(0) != 0).unwrap_or(false))
            }
            OID_KU => {
                let (unused, bytes) = e.value.bits()?;
                let mut set = HashSet::new();
                for bit in 0..(bytes.len() as u32 * 8).saturating_sub(unused as u32) {
                    if bytes[(bit >> 3) as usize] & (0x80 >> (bit & 7)) != 0 {
                        set.insert(bit);
                    }
                }
                c.key_usage = Some(set);
            }
            OID_IP | OID_IP2 => parse_ip_blocks(&e.value, &mut c.resources)?,
            OID_AS | OID_AS2 => c.resources.asn = parse_as_ids(&e.value)?,
            _ => {}
        }
    }
    Ok(c)
}

fn cert_label(c: &Cert) -> String {
    c.subject_name
        .split(", ")
        .find_map(|p| p.strip_prefix("CN="))
        .map(|s| s.to_string())
        .unwrap_or_else(|| c.subject_name.clone())
}

fn is_self_issued(c: &Cert) -> bool {
    c.subject == c.issuer
        && match (&c.aki, &c.ski) {
            (Some(a), Some(s)) => a == s,
            _ => true,
        }
}

#[derive(Clone)]
struct Crl {
    node: Option<usize>,
    tbs: Vec<u8>,
    sig_alg: String,
    signature: Vec<u8>,
    issuer: Vec<u8>,
    issuer_name: String,
    this_update: i64,
    next_update: Option<i64>,
    revoked: Vec<(Vec<u8>, i64)>,
    aki: Option<Vec<u8>>,
    crl_number: Option<i128>,
}

fn parse_crl(n: &N) -> R<Crl> {
    let crl = n.expect(SEQ, "CertificateList")?;
    let tbs = crl.kid(0, "tbsCertList")?.expect(SEQ, "tbsCertList")?;
    let sig_alg = alg_oid(crl.kid(1, "signatureAlgorithm")?, "signatureAlgorithm")?;
    let (_, sig) = crl.kid(2, "signatureValue")?.bits()?;
    let f = &tbs.kids;
    let mut i = 0;
    if f.get(0).map(|k| k.tag == INT).unwrap_or(false) {
        i += 1;
    }
    alg_oid(tbs.kid(i, "signature")?, "tbsCertList signature")?;
    i += 1;
    let issuer = tbs.kid(i, "issuer")?.expect(SEQ, "issuer")?;
    i += 1;
    let this_update = tbs.kid(i, "thisUpdate")?.time()?;
    i += 1;
    let mut next_update = None;
    if f.get(i).map(|k| k.is_time()).unwrap_or(false) {
        next_update = Some(f[i].time()?);
        i += 1;
    }
    let mut revoked = vec![];
    if f.get(i).map(|k| k.tag == SEQ).unwrap_or(false) {
        for r in &f[i].kids {
            revoked.push((norm_int(&r.kid(0, "userCertificate")?.content).to_vec(), r.kid(1, "revocationDate")?.time()?));
        }
        i += 1;
    }
    let mut out = Crl {
        node: crl.id,
        tbs: tbs.raw.clone(),
        sig_alg,
        signature: sig.to_vec(),
        issuer: issuer.raw.clone(),
        issuer_name: format_name(issuer),
        this_update,
        next_update,
        revoked,
        aki: None,
        crl_number: None,
    };
    for (oid, e) in parse_extensions(f[i.min(f.len())..].iter().find(|k| k.is_ctx(0)))? {
        match oid.as_str() {
            OID_AKI => out.aki = parse_aki(&e.value),
            OID_CRLNUM => out.crl_number = e.value.int().ok(),
            _ => {}
        }
    }
    Ok(out)
}

struct Csr {
    node: Option<usize>,
    tbs: Vec<u8>,
    sig_alg: String,
    signature: Vec<u8>,
    subject_name: String,
    key: PublicKey,
}

fn parse_csr(n: &N) -> R<Csr> {
    let tbs = n.kid(0, "certificationRequestInfo")?.expect(SEQ, "certificationRequestInfo")?;
    Ok(Csr {
        node: n.id,
        tbs: tbs.raw.clone(),
        sig_alg: alg_oid(n.kid(1, "signatureAlgorithm")?, "signatureAlgorithm")?,
        signature: n.kid(2, "signature")?.bits()?.1.to_vec(),
        subject_name: format_name(tbs.kid(1, "subject")?),
        key: parse_spki(tbs.kid(2, "subjectPublicKeyInfo")?)?,
    })
}

// ─── CMS SignedData ───────────────────────────────────────────────────────────

struct Attr {
    oid: String,
    node: Option<usize>,
    values: Vec<N>,
}

struct SignerInfo {
    node: Option<usize>,
    version: i128,
    sid_ski: Option<Vec<u8>>,
    sid_issuer: Option<Vec<u8>>,
    sid_serial: Option<Vec<u8>>,
    digest_alg: String,
    signed_attrs_der: Option<Vec<u8>>,
    signed_attrs: Vec<Attr>,
    sig_alg: String,
    signature: Vec<u8>,
    signature_node: Option<usize>,
    unsigned_attrs: bool,
}

struct Signed {
    version: i128,
    digest_algs: Vec<String>,
    e_content_type: String,
    e_content: Option<Vec<u8>>,
    e_content_node: Option<N>,
    certs: Vec<Cert>,
    cert_errors: Vec<String>,
    crl_count: usize,
    signers: Vec<SignerInfo>,
}

fn parse_signed(root: &N) -> R<Signed> {
    let ci = root.expect(SEQ, "ContentInfo")?;
    let ct = ci.kid(0, "contentType")?.oid()?;
    if ct != OID_SIGNED_DATA {
        return Err(format!("ContentInfo contentType is {}, not signedData", ct));
    }
    let wrap = ci.kid(1, "ContentInfo content [0]")?;
    if !wrap.is_ctx(0) {
        return Err("ContentInfo content [0] is missing".into());
    }
    let sd = wrap.kid(0, "SignedData")?.expect(SEQ, "SignedData")?;
    let f = &sd.kids;
    let version = sd.kid(0, "SignedData version")?.int()?;
    let digest_algs = sd.kid(1, "digestAlgorithms")?.expect(SET, "digestAlgorithms")?.kids.iter().filter_map(|a| a.kids.get(0).and_then(|o| o.oid().ok())).collect();
    let eci = sd.kid(2, "encapContentInfo")?.expect(SEQ, "encapContentInfo")?;
    let e_content_type = eci.kid(0, "eContentType")?.oid()?;
    let mut e_content = None;
    let mut e_content_node = None;
    if let Some(w) = eci.kids.get(1).filter(|k| k.is_ctx(0)) {
        let os = w.kid(0, "eContent")?;
        if os.tag == 0x24 {
            e_content = Some(os.kids.iter().flat_map(|k| k.content.clone()).collect());
        } else {
            os.expect(OCTETS, "eContent")?;
            e_content = Some(os.content.clone());
            if os.kids.len() == 1 && os.kids[0].raw == os.content {
                e_content_node = Some(os.kids[0].clone());
            }
        }
    }
    let mut certs = vec![];
    let mut cert_errors = vec![];
    let mut crl_count = 0;
    let mut i = 3;
    while let Some(k) = f.get(i).filter(|k| k.tag & 0xc0 == 0x80) {
        if k.is_ctx(0) {
            for c in &k.kids {
                match parse_cert(c) {
                    Ok(c) => certs.push(c),
                    Err(e) => cert_errors.push(e),
                }
            }
        } else if k.is_ctx(1) {
            crl_count += k.kids.len();
        }
        i += 1;
    }
    let signers = sd.kid(i, "signerInfos")?.expect(SET, "signerInfos")?.kids.iter().map(parse_signer).collect::<R<Vec<_>>>()?;
    Ok(Signed { version, digest_algs, e_content_type, e_content, e_content_node, certs, cert_errors, crl_count, signers })
}

fn parse_signer(n: &N) -> R<SignerInfo> {
    let s = n.expect(SEQ, "SignerInfo")?;
    let version = s.kid(0, "SignerInfo version")?.int()?;
    let sid = s.kid(1, "sid")?;
    let (mut sid_ski, mut sid_issuer, mut sid_serial) = (None, None, None);
    if sid.is_ctx(0) {
        sid_ski = Some(sid.content.clone());
    } else if sid.tag == SEQ {
        sid_issuer = Some(sid.kid(0, "issuer")?.raw.clone());
        sid_serial = Some(norm_int(&sid.kid(1, "serial")?.content).to_vec());
    } else {
        return Err("SignerInfo sid has an unexpected form".into());
    }
    let digest_alg = alg_oid(s.kid(2, "digestAlgorithm")?, "digestAlgorithm")?;
    let mut i = 3;
    let mut signed_attrs_der = None;
    let mut signed_attrs = vec![];
    if let Some(sa) = s.kids.get(3).filter(|k| k.is_ctx(0)) {
        let mut der = sa.raw.clone();
        der[0] = SET; // the signature covers the attributes with an explicit SET OF tag
        signed_attrs_der = Some(der);
        for a in &sa.kids {
            signed_attrs.push(Attr {
                oid: a.kid(0, "attribute type")?.oid()?,
                node: a.id,
                values: a.kids.get(1).map(|v| v.kids.clone()).unwrap_or_default(),
            });
        }
        i += 1;
    }
    let sig_alg = alg_oid(s.kid(i, "signatureAlgorithm")?, "signatureAlgorithm")?;
    let sig = s.kid(i + 1, "signature")?.expect(OCTETS, "signature")?;
    Ok(SignerInfo {
        node: s.id,
        version,
        sid_ski,
        sid_issuer,
        sid_serial,
        digest_alg,
        signed_attrs_der,
        signed_attrs,
        sig_alg,
        signature: sig.content.clone(),
        signature_node: sig.id,
        unsigned_attrs: s.kids.get(i + 2).map(|k| k.is_ctx(1)).unwrap_or(false),
    })
}

enum Parsed {
    Signed(Signed),
    Cert(Cert),
    Crl(Crl),
    Csr(Csr),
}

fn detect(root: &N) -> R<Parsed> {
    let unknown = || "Unrecognised object: expected a signed object, certificate, CRL or CSR".to_string();
    if root.tag != SEQ {
        return Err("Top-level element is not a SEQUENCE".into());
    }
    let first = root.kids.get(0).ok_or_else(unknown)?;
    if first.tag == OIDT {
        return parse_signed(root).map(Parsed::Signed);
    }
    if first.tag != SEQ || root.kids.len() != 3 {
        return Err(unknown());
    }
    let tf = &first.kids;
    if tf.get(0).map(|k| k.is_ctx(0)).unwrap_or(false) {
        return parse_cert(root).map(Parsed::Cert);
    }
    let off = if tf.get(0).map(|k| k.tag == INT).unwrap_or(false) { 1 } else { 0 };
    if let Some(after) = tf.get(off + 2) {
        if after.is_time() {
            return parse_crl(root).map(Parsed::Crl);
        }
        if after.tag == SEQ && after.kids.len() == 2 && after.kids[0].is_time() {
            return parse_cert(root).map(Parsed::Cert);
        }
    }
    if off == 1 && tf.get(1).map(|k| k.tag == SEQ).unwrap_or(false) && tf.get(2).map(|k| k.tag == SEQ).unwrap_or(false) && tf.get(3).map(|k| k.is_ctx(0)).unwrap_or(false) {
        return parse_csr(root).map(Parsed::Csr);
    }
    Err(unknown())
}

// ─── Report ───────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct Check {
    pub group: String,
    pub title: String,
    pub status: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    /// Editor node this check is about.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node: Option<usize>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyReport {
    pub object_type: String,
    pub verdict: &'static str,
    pub summary: String,
    pub checks: Vec<Check>,
    pub chain_provided: bool,
    pub path: Vec<String>,
}

struct Rep {
    group: &'static str,
    checks: Vec<Check>,
}

impl Rep {
    fn new(group: &'static str) -> Self {
        Rep { group, checks: vec![] }
    }
    fn add(&mut self, status: &'static str, title: impl Into<String>, detail: impl Into<String>, node: Option<usize>) {
        let d: String = detail.into();
        self.checks.push(Check { group: self.group.to_string(), title: title.into(), status, detail: if d.is_empty() { None } else { Some(d) }, node });
    }
    fn pass(&mut self, t: impl Into<String>, d: impl Into<String>, n: Option<usize>) {
        self.add("pass", t, d, n)
    }
    fn fail(&mut self, t: impl Into<String>, d: impl Into<String>, n: Option<usize>) {
        self.add("fail", t, d, n)
    }
    fn warn(&mut self, t: impl Into<String>, d: impl Into<String>, n: Option<usize>) {
        self.add("warn", t, d, n)
    }
    fn info(&mut self, t: impl Into<String>, d: impl Into<String>, n: Option<usize>) {
        self.add("info", t, d, n)
    }
    fn skip(&mut self, t: impl Into<String>, d: impl Into<String>, n: Option<usize>) {
        self.add("skip", t, d, n)
    }
}

#[allow(clippy::too_many_arguments)]
fn check_signature(r: &mut Rep, title: &str, key: &PublicKey, alg: &str, data: &[u8], sig: &[u8], signer: &str, hash_override: Option<Hash>, node: Option<usize>) -> bool {
    match verify_sig(key, alg, data, sig, hash_override) {
        Ok(true) => {
            let mut a = sig_name(alg);
            if let (Some(h), Some((_, None, _))) = (hash_override, sig_alg(alg)) {
                a += &format!(" / {}", h.name());
            }
            r.pass(title, format!("Verified with {} ({}).", signer, a), node);
            true
        }
        Ok(false) => {
            r.fail(title, format!("Signature does not verify with {}.", signer), node);
            false
        }
        Err(SigError::Unsupported(m)) => {
            r.skip(title, m, node);
            false
        }
        Err(SigError::Other(m)) => {
            r.fail(title, format!("Could not verify: {}", m), node);
            false
        }
    }
}

fn check_validity(r: &mut Rep, what: &str, nb: i64, na: i64, now: i64, node: Option<usize>) {
    let t = format!("{} validity period", what);
    if nb > na {
        r.fail(t, format!("notBefore ({}) is after notAfter ({}).", fmt_time(nb), fmt_time(na)), node)
    } else if now < nb {
        r.fail(t, format!("Not valid before {}.", fmt_time(nb)), node)
    } else if now > na {
        r.fail(t, format!("Expired on {}.", fmt_time(na)), node)
    } else {
        r.pass(t, format!("{} to {}.", fmt_time(nb), fmt_time(na)), node)
    }
}

fn check_ski(r: &mut Rep, what: &str, c: &Cert) {
    let t = format!("{} subject key identifier", what);
    match &c.ski {
        None => r.warn(t, "No Subject Key Identifier extension.", c.ext_node),
        Some(ski) => {
            let expected = Hash::Sha1.digest(&c.key.key_bits);
            if &expected == ski {
                r.pass(t, "Matches the SHA-1 hash of the public key.", c.ext_node)
            } else {
                r.warn(t, format!("SKI {} differs from the SHA-1 key hash {} (required by the RPKI profile, optional elsewhere).", hexs(ski), hexs(&expected)), c.ext_node)
            }
        }
    }
}

fn check_crl_times(r: &mut Rep, what: &str, crl: &Crl, now: i64) {
    let t = format!("{} update times", what);
    match crl.next_update {
        None => r.warn(t, format!("thisUpdate {}, no nextUpdate.", fmt_time(crl.this_update)), crl.node),
        Some(_) if now < crl.this_update => r.fail(t, format!("thisUpdate {} is in the future.", fmt_time(crl.this_update)), crl.node),
        Some(nu) if now > nu => r.warn(t, format!("Stale: nextUpdate was {}.", fmt_time(nu)), crl.node),
        Some(nu) => r.pass(t, format!("{} to {}.", fmt_time(crl.this_update), fmt_time(nu)), crl.node),
    }
}

// ─── Chain validation ─────────────────────────────────────────────────────────

struct Pool {
    certs: Vec<Cert>,
    crls: Vec<Crl>,
}

fn build_pool(chain: &[Vec<u8>], r: &mut Rep) -> Pool {
    let mut pool = Pool { certs: vec![], crls: vec![] };
    for (n, b) in chain.iter().enumerate() {
        match parse_bytes(b).and_then(|root| detect(&root)) {
            Ok(Parsed::Cert(c)) => pool.certs.push(Cert { node: None, validity_node: None, ext_node: None, ..c }),
            Ok(Parsed::Crl(c)) => pool.crls.push(Crl { node: None, ..c }),
            Ok(_) => r.warn(format!("Chain item {}", n + 1), "Ignored: only certificates and CRLs are used from the chain.", None),
            Err(e) => r.fail(format!("Chain item {}", n + 1), format!("Could not parse: {}", e), None),
        }
    }
    r.info("Chain input", format!("{} certificate(s), {} CRL(s).", pool.certs.len(), pool.crls.len()), None);
    pool
}

struct Subject {
    label: String,
    issuer: Vec<u8>,
    aki: Option<Vec<u8>>,
    tbs: Vec<u8>,
    sig_alg: String,
    signature: Vec<u8>,
    cert: Option<Cert>,
    needs_usage: u32,
    node: Option<usize>,
}

fn subject_of_cert(c: &Cert) -> Subject {
    Subject {
        label: cert_label(c),
        issuer: c.issuer.clone(),
        aki: c.aki.clone(),
        tbs: c.tbs.clone(),
        sig_alg: c.sig_alg.clone(),
        signature: c.signature.clone(),
        cert: Some(c.clone()),
        needs_usage: KU_KEY_CERT_SIGN,
        node: c.node,
    }
}

fn subject_of_crl(c: &Crl) -> Subject {
    Subject {
        label: format!("CRL of {}", c.issuer_name),
        issuer: c.issuer.clone(),
        aki: c.aki.clone(),
        tbs: c.tbs.clone(),
        sig_alg: c.sig_alg.clone(),
        signature: c.signature.clone(),
        cert: None,
        needs_usage: KU_CRL_SIGN,
        node: c.node,
    }
}

fn check_revocation(r: &mut Rep, subject: &Cert, issuer: &Cert, pool: &Pool, now: i64) {
    for crl in pool.crls.iter().filter(|c| c.issuer == issuer.subject && matches_key_id(&c.aki, &issuer.ski)) {
        let il = cert_label(issuer);
        if !check_signature(r, &format!("CRL of {} signature", il), &issuer.key, &crl.sig_alg, &crl.tbs, &crl.signature, &format!("the key of {}", il), None, None) {
            continue;
        }
        check_crl_times(r, &format!("CRL of {}", il), crl, now);
        match crl.revoked.iter().find(|(s, _)| *s == subject.serial) {
            Some((_, d)) => r.fail(format!("Revocation status of {}", cert_label(subject)), format!("Serial {} was revoked on {}.", hexs(&subject.serial), fmt_time(*d)), subject.node),
            None => r.pass(format!("Revocation status of {}", cert_label(subject)), format!("Not listed on the CRL of {}.", il), subject.node),
        }
    }
}

fn matches_key_id(aki: &Option<Vec<u8>>, ski: &Option<Vec<u8>>) -> bool {
    match (aki, ski) {
        (Some(a), Some(s)) => a == s,
        _ => true,
    }
}

/// Walk from `start` up through the pool; returns the certificate path and whether
/// a self-signed anchor was reached.
fn validate_path(r: &mut Rep, start: Subject, pool: &Pool, now: i64) -> (Vec<Cert>, bool) {
    let mut path: Vec<Cert> = start.cert.iter().cloned().collect();
    let mut used: HashSet<usize> = HashSet::new();
    let mut current = start;
    for depth in 0..32 {
        if let Some(c) = current.cert.as_ref().filter(|c| is_self_issued(c)) {
            let ok = check_signature(r, &format!("Trust anchor {} self-signature", current.label), &c.key, &current.sig_alg, &current.tbs, &current.signature, "its own key", None, current.node);
            if ok && c.is_ca == Some(false) {
                r.warn(format!("Trust anchor {}", current.label), "Self-signed but not marked as a CA.", current.node);
            }
            return (path, ok);
        }
        let candidates: Vec<usize> = (0..pool.certs.len()).filter(|i| !used.contains(i) && pool.certs[*i].subject == current.issuer).collect();
        let mut ordered: Vec<usize> = candidates.iter().copied().filter(|i| current.aki.is_some() && pool.certs[*i].ski == current.aki).collect();
        let rest: Vec<usize> = candidates.iter().copied().filter(|i| !ordered.contains(i)).collect();
        ordered.extend(rest);
        if ordered.is_empty() {
            if depth == 0 {
                let kid = current.aki.as_ref().map(|a| format!(" and key identifier {}.", hexs(a))).unwrap_or_else(|| ".".into());
                r.fail(format!("Issuer of {}", current.label), format!("No certificate in the provided chain has a matching subject name{}", kid), current.node);
            } else {
                r.warn("Trust anchor", format!("The chain ends at {}, which is not self-signed. The signatures up to it are valid, but trust is not anchored.", current.label), None);
            }
            return (path, false);
        }
        let found = ordered.iter().copied().find(|i| matches!(verify_sig(&pool.certs[*i].key, &current.sig_alg, &current.tbs, &current.signature, None), Ok(true)));
        let idx = match found {
            Some(i) => i,
            None => {
                let first = &pool.certs[ordered[0]];
                check_signature(r, &format!("Signature of {}", current.label), &first.key, &current.sig_alg, &current.tbs, &current.signature, &format!("the key of {}", cert_label(first)), None, current.node);
                return (path, false);
            }
        };
        let issuer = pool.certs[idx].clone();
        let il = cert_label(&issuer);
        r.pass(format!("Signature of {}", current.label), format!("Verified with the key of {} ({}).", il, sig_name(&current.sig_alg)), current.node);
        if current.aki.is_some() && issuer.ski != current.aki {
            r.warn(format!("Key identifier of {}", current.label), format!("Authority key identifier {} does not match the issuer's subject key identifier.", hexs(current.aki.as_ref().unwrap())), current.node);
        }
        check_validity(r, &il, issuer.not_before, issuer.not_after, now, None);
        if issuer.is_ca != Some(true) {
            r.fail(format!("{} is a CA", il), "The issuer has no basicConstraints cA=TRUE.", None);
        }
        if let Some(ku) = &issuer.key_usage {
            if !ku.contains(&current.needs_usage) {
                let msg = if current.needs_usage == KU_CRL_SIGN { "The issuer may not sign CRLs (no cRLSign)." } else { "The issuer may not sign certificates (no keyCertSign)." };
                r.fail(format!("{} key usage", il), msg, None);
            }
        }
        if let Some(c) = &current.cert {
            check_revocation(r, c, &issuer, pool, now);
        }
        used.insert(idx);
        path.push(issuer.clone());
        current = subject_of_cert(&issuer);
    }
    r.fail("Chain", "The chain is too long (more than 32 certificates).", None);
    (path, false)
}

/// Top-down "inherit" resolution and containment over a path (object first, anchor last).
/// Returns the effective resources of the first certificate.
fn check_path_resources(r: &mut Rep, path: &[Cert]) -> Option<Resources> {
    let mut parent: Option<Resources> = None;
    for c in path.iter().rev() {
        let p = match &parent {
            None => {
                if c.resources.has_inherit() {
                    r.warn(format!("Resources of {}", cert_label(c)), "The top certificate of the chain inherits resources, so they cannot be resolved.", c.ext_node);
                }
                parent = Some(c.resources.clone());
                continue;
            }
            Some(p) => p.clone(),
        };
        let mut eff = Resources::empty();
        let mut problems = vec![];
        for k in RKINDS {
            match c.resources.get(k) {
                RList::Inherit => eff.set(k, p.get(k).clone()),
                RList::None => {}
                RList::Ranges(v) => {
                    eff.set(k, RList::Ranges(v.clone()));
                    match p.get(k) {
                        RList::Inherit => {}
                        RList::None => problems.push(format!("{} resources are not held by the issuer", k.name())),
                        RList::Ranges(pv) => {
                            if let Some(out) = ranges_contained(v, pv) {
                                problems.push(format!("{} is not held by the issuer", fmt_range(out, k)));
                            }
                        }
                    }
                }
            }
        }
        if !problems.is_empty() {
            r.fail(format!("Resources of {}", cert_label(c)), format!("{}.", problems.join("; ")), c.ext_node);
        } else if c.resources.has_any() {
            r.pass(format!("Resources of {}", cert_label(c)), format!("Contained in the issuer's resources ({}).", describe_resources(&c.resources)), c.ext_node);
        }
        parent = Some(eff);
    }
    parent
}

// ─── Signed object payloads ───────────────────────────────────────────────────

fn check_against_ee(r: &mut Rep, title: &str, k: RKind, wanted: &[Range], ee: &Resources, resolved: bool, node: Option<usize>) {
    match ee.get(k) {
        RList::Inherit => r.skip(title, format!("The EE certificate inherits its {} resources; provide the chain to resolve them.", k.name()), node),
        held => {
            let empty = vec![];
            let hv = if let RList::Ranges(v) = held { v } else { &empty };
            match ranges_contained(wanted, hv) {
                Some(out) => r.fail(title, format!("{} is not covered by the EE certificate{}.", fmt_range(out, k), if resolved { " (after resolving inheritance)" } else { "" }), node),
                None => r.pass(title, format!("All {} {} entries are covered by the EE certificate.", wanted.len(), k.name()), node),
            }
        }
    }
}

fn check_roa(r: &mut Rep, content: &N, ee: Option<&Resources>, resolved: bool) -> R<()> {
    let s = content.expect(SEQ, "RouteOriginAttestation")?;
    let mut i = 0;
    if s.kids.get(0).map(|k| k.is_ctx(0)).unwrap_or(false) {
        let v = s.kids[0].kid(0, "version")?.int()?;
        if v != 0 {
            r.fail("ROA version", format!("Version is {}, expected 0.", v), s.kids[0].id);
        }
        i += 1;
    }
    let as_id = s.kid(i, "asID")?.int()?;
    let blocks = s.kid(i + 1, "ipAddrBlocks")?.expect(SEQ, "ipAddrBlocks")?;
    let mut wanted: [(RKind, Vec<Range>, Option<usize>); 2] = [(RKind::V4, vec![], None), (RKind::V6, vec![], None)];
    let mut bad = vec![];
    let mut bad_node = None;
    let mut count = 0;
    for fam in &blocks.kids {
        let afi = &fam.kid(0, "addressFamily")?.expect(OCTETS, "addressFamily")?.content;
        let slot = match afi.as_slice() {
            [0, 1] => 0,
            [0, 2] => 1,
            _ => {
                bad.push(format!("unknown address family {}", hexs(afi)));
                bad_node = bad_node.or(fam.id);
                continue;
            }
        };
        let kind = wanted[slot].0;
        for a in &fam.kid(1, "addresses")?.expect(SEQ, "addresses")?.kids {
            count += 1;
            let p = a.kid(0, "address")?;
            let (lo, len) = bits_to_addr(p, kind.width(), false)?;
            let (hi, _) = bits_to_addr(p, kind.width(), true)?;
            wanted[slot].1.push((lo, hi));
            wanted[slot].2 = wanted[slot].2.or(fam.id);
            if let Some(m) = a.kids.get(1) {
                let max = m.int()?;
                if max < len as i128 || max > kind.width() as i128 {
                    bad.push(format!("{} has maxLength {}", fmt_range((lo, hi), kind), max));
                    bad_node = bad_node.or(a.id);
                }
            }
        }
    }
    r.info("ROA payload", format!("AS{}, {} prefix(es).", as_id, count), content.id);
    if bad.is_empty() {
        r.pass("ROA prefixes", "Address families and maxLength values are well-formed.", blocks.id)
    } else {
        r.fail("ROA prefixes", format!("{}.", bad.join("; ")), bad_node)
    }
    if let Some(ee) = ee {
        for (k, v, node) in &wanted {
            if !v.is_empty() {
                check_against_ee(r, &format!("ROA {} prefixes within EE resources", k.name()), *k, v, ee, resolved, *node);
            }
        }
    }
    Ok(())
}

fn check_aspa(r: &mut Rep, content: &N, ee: Option<&Resources>, resolved: bool) -> R<()> {
    let s = content.expect(SEQ, "ASProviderAttestation")?;
    let mut i = 0;
    if s.kids.get(0).map(|k| k.is_ctx(0)).unwrap_or(false) {
        let v = s.kids[0].kid(0, "version")?.int()?;
        if v != 1 {
            r.fail("ASPA version", format!("Version is {}, expected 1.", v), s.kids[0].id)
        } else {
            r.pass("ASPA version", "Version 1.", s.kids[0].id)
        }
        i += 1;
    } else {
        r.fail("ASPA version", "Version field is missing (must be explicitly 1).", s.id);
    }
    let cust_node = s.kid(i, "customerASID")?;
    let customer = cust_node.int()?;
    let prov = s.kid(i + 1, "providers")?.expect(SEQ, "providers")?;
    let providers = prov.kids.iter().map(|p| p.int()).collect::<R<Vec<_>>>()?;
    r.info("ASPA payload", format!("Customer AS{}, {} provider(s).", customer, providers.len()), content.id);
    let sorted = providers.windows(2).all(|w| w[0] < w[1]);
    if providers.is_empty() {
        r.fail("ASPA providers", "The provider set is empty.", prov.id)
    } else if !sorted {
        r.fail("ASPA providers", "Providers must be in strictly ascending order without duplicates.", prov.id)
    } else if providers.contains(&customer) {
        r.fail("ASPA providers", "The customer AS is listed as its own provider.", prov.id)
    } else {
        r.pass("ASPA providers", "Sorted, unique, and the customer is not a provider.", prov.id)
    }
    if let Some(ee) = ee {
        if ee.v4 != RList::None || ee.v6 != RList::None {
            r.warn("ASPA EE certificate", "The EE certificate carries IP resources, which the ASPA profile does not allow.", None);
        }
        let c = customer as u128;
        check_against_ee(r, "Customer AS within EE resources", RKind::As, &[(c, c)], ee, resolved, cust_node.id);
    }
    Ok(())
}

fn check_manifest(r: &mut Rep, content: &N, ee: Option<&Cert>, now: i64) -> R<()> {
    let s = content.expect(SEQ, "Manifest")?;
    let mut i = 0;
    if s.kids.get(0).map(|k| k.is_ctx(0)).unwrap_or(false) {
        i += 1;
    }
    let number = s.kid(i, "manifestNumber")?.int()?;
    let tu_node = s.kid(i + 1, "thisUpdate")?;
    let this_update = tu_node.time()?;
    let next_update = s.kid(i + 2, "nextUpdate")?.time()?;
    let hash_alg = s.kid(i + 3, "fileHashAlg")?.oid()?;
    let files = s.kid(i + 4, "fileList")?.expect(SEQ, "fileList")?;
    let hname = digest_alg(&hash_alg).map(|h| h.name().to_string()).unwrap_or_else(|| hash_alg.clone());
    r.info("Manifest payload", format!("Number {}, {} file(s), hash {}.", number, files.kids.len(), hname), content.id);
    let t = "Manifest update times";
    if this_update >= next_update {
        r.fail(t, "thisUpdate is not before nextUpdate.", tu_node.id)
    } else if now < this_update {
        r.fail(t, format!("thisUpdate {} is in the future.", fmt_time(this_update)), tu_node.id)
    } else if now > next_update {
        r.warn(t, format!("Stale: nextUpdate was {}.", fmt_time(next_update)), tu_node.id)
    } else {
        r.pass(t, format!("{} to {}.", fmt_time(this_update), fmt_time(next_update)), tu_node.id)
    }
    if let Some(ee) = ee {
        if this_update < ee.not_before || next_update > ee.not_after {
            r.warn("Manifest within EE validity", "thisUpdate/nextUpdate fall outside the EE certificate validity.", tu_node.id);
        }
    }
    if hash_alg != OID_SHA256 {
        r.warn("Manifest hash algorithm", format!("Expected SHA-256, found {}.", hash_alg), None);
    }
    let mut names = HashSet::new();
    let mut dup = false;
    let mut malformed = 0;
    for fe in &files.kids {
        if let Some(n) = fe.kids.get(0) {
            dup |= !names.insert(n.string());
        }
        match fe.kids.get(1).map(|h| h.bits()) {
            Some(Ok((_, b))) if b.len() == 32 => {}
            _ => malformed += 1,
        }
    }
    if malformed > 0 {
        r.fail("Manifest file list", format!("{} entries have a hash that is not 32 bytes.", malformed), files.id);
    }
    if dup {
        r.warn("Manifest file list", "Duplicate file names.", files.id);
    }
    r.skip("Manifest file hashes", "The listed files are not available here, so their hashes cannot be checked.", files.id);
    Ok(())
}

struct Outcome {
    object_type: String,
    anchored: bool,
    path: Vec<String>,
}

fn verify_signed(obj: &Signed, chain: &[Vec<u8>], now: i64, out: &mut Vec<Check>) -> Outcome {
    let type_name = content_type_name(&obj.e_content_type).map(|s| s.to_string()).unwrap_or_else(|| format!("signed object ({})", obj.e_content_type));
    let is_rpki = content_type_name(&obj.e_content_type).is_some() && obj.e_content_type != "1.2.840.113549.1.7.1";

    let mut s = Rep::new("Structure");
    s.info("Object type", format!("CMS SignedData containing {}.", type_name), None);
    if obj.version != 3 {
        s.warn("SignedData version", format!("Version {}; the RPKI profile requires 3.", obj.version), None);
    }
    if obj.e_content.is_none() {
        s.fail("Encapsulated content", "eContent is absent (detached signature), so the content digest cannot be checked.", None);
    }
    if !obj.cert_errors.is_empty() {
        s.fail("Embedded certificates", obj.cert_errors.join("; "), None);
    }
    if obj.certs.len() != 1 {
        s.warn("Embedded certificates", format!("{} certificates embedded; the RPKI profile requires exactly one EE certificate.", obj.certs.len()), None);
    }
    if obj.crl_count > 0 {
        s.warn("Embedded CRLs", "The RPKI profile does not allow CRLs inside signed objects.", None);
    }
    if obj.signers.len() != 1 {
        s.warn("SignerInfos", format!("{} SignerInfos; the RPKI profile requires exactly one.", obj.signers.len()), None);
    }
    out.extend(s.checks);

    let si = match obj.signers.first() {
        Some(si) => si,
        None => {
            let mut g = Rep::new("Signature");
            g.fail("SignerInfo", "No SignerInfo is present.", None);
            out.extend(g.checks);
            return Outcome { object_type: type_name, anchored: false, path: vec![] };
        }
    };

    let ee = obj.certs.iter().find(|c| match &si.sid_ski {
        Some(ski) => c.ski.as_ref() == Some(ski),
        None => si.sid_issuer.as_ref() == Some(&c.issuer) && si.sid_serial.as_ref() == Some(&c.serial),
    });

    // Digests
    let mut d = Rep::new("Content digest");
    let hash = digest_alg(&si.digest_alg);
    if !obj.digest_algs.contains(&si.digest_alg) {
        d.warn("Digest algorithms", "The signer digest algorithm is not listed in SignedData digestAlgorithms.", si.node);
    }
    if is_rpki && si.digest_alg != OID_SHA256 {
        d.warn("Digest algorithm", format!("RPKI requires SHA-256; found {}.", si.digest_alg), si.node);
    }
    let attr = |oid: &str| si.signed_attrs.iter().find(|a| a.oid == oid);
    if si.signed_attrs_der.is_none() {
        d.warn("Signed attributes", "No signed attributes; the signature covers the content directly.", si.node);
    } else {
        match attr(OID_CT_ATTR) {
            None => d.fail("content-type attribute", "Missing.", si.node),
            Some(a) => match a.values.first().map(|v| v.oid()) {
                Some(Ok(v)) if v == obj.e_content_type => d.pass("content-type attribute", "Matches eContentType.", a.node),
                Some(Ok(v)) => d.fail("content-type attribute", format!("Says {}, but eContentType is {}.", v, obj.e_content_type), a.node),
                _ => d.fail("content-type attribute", "Value is not an OID.", a.node),
            },
        }
    }
    match (hash, &obj.e_content, &si.signed_attrs_der) {
        (None, _, _) => d.skip("message-digest attribute", format!("Digest algorithm {} is not supported.", si.digest_alg), si.node),
        (_, None, _) => d.skip("message-digest attribute", "No eContent to hash.", None),
        (Some(h), Some(ec), Some(_)) => {
            let actual = h.digest(ec);
            match attr(OID_MD_ATTR) {
                None => d.fail("message-digest attribute", "Missing.", si.node),
                Some(a) => {
                    let claimed = a.values.first().map(|v| v.content.clone()).unwrap_or_default();
                    if claimed == actual {
                        d.pass("message-digest attribute", format!("{} of eContent matches ({}…).", h.name(), &hexs(&actual)[..16]), a.node)
                    } else {
                        d.fail("message-digest attribute", format!("{} of eContent is {}, but the attribute says {}.", h.name(), hexs(&actual), hexs(&claimed)), a.node)
                    }
                }
            }
        }
        _ => {}
    }
    if let Some(a) = attr(OID_ST_ATTR) {
        match a.values.first().map(|v| v.time()) {
            Some(Ok(t)) => d.info("signing-time attribute", fmt_time(t), a.node),
            Some(Err(e)) => d.fail("signing-time attribute", e, a.node),
            None => d.fail("signing-time attribute", "Empty.", a.node),
        }
    }
    if is_rpki {
        let allowed = [OID_CT_ATTR, OID_MD_ATTR, OID_ST_ATTR, OID_BST_ATTR];
        let extra: Vec<&Attr> = si.signed_attrs.iter().filter(|a| !allowed.contains(&a.oid.as_str())).collect();
        if !extra.is_empty() {
            d.warn("Signed attributes", format!("Attributes not allowed by the RPKI profile: {}.", extra.iter().map(|a| a.oid.as_str()).collect::<Vec<_>>().join(", ")), extra[0].node);
        }
        if si.unsigned_attrs {
            d.warn("Unsigned attributes", "The RPKI profile does not allow unsigned attributes.", si.node);
        }
    }
    out.extend(d.checks);

    // Signature
    let mut g = Rep::new("Signature");
    if si.version != 3 {
        g.warn("SignerInfo version", format!("Version {}; the RPKI profile requires 3 (SKI as signer identifier).", si.version), si.node);
    }
    match ee {
        None => {
            let msg = match &si.sid_ski {
                Some(s) => format!("No embedded certificate has SKI {}.", hexs(s)),
                None => "No embedded certificate matches the issuer and serial number.".into(),
            };
            g.fail("Signer certificate", msg, si.node)
        }
        Some(ee) => {
            g.pass("Signer certificate", format!("Found the EE certificate {} by {}.", cert_label(ee), if si.sid_ski.is_some() { "subject key identifier" } else { "issuer and serial" }), ee.node);
            if is_rpki && si.sig_alg != OID_RSA && si.sig_alg != OID_SHA256_RSA {
                g.warn("Signature algorithm", format!("{} is not allowed by the RPKI algorithm profile.", sig_name(&si.sig_alg)), si.node);
            }
            let signed = si.signed_attrs_der.as_ref().or(obj.e_content.as_ref());
            if let Some(data) = signed {
                check_signature(&mut g, "CMS signature", &ee.key, &si.sig_alg, data, &si.signature, "the public key of the EE certificate", hash, si.signature_node);
            }
        }
    }
    out.extend(g.checks);

    // EE certificate
    let mut e = Rep::new("EE certificate");
    if let Some(ee) = ee {
        check_validity(&mut e, "EE certificate", ee.not_before, ee.not_after, now, ee.validity_node);
        check_ski(&mut e, "EE certificate", ee);
        if ee.is_ca == Some(true) {
            e.warn("EE certificate is not a CA", "basicConstraints marks it as a CA.", ee.ext_node);
        }
        if let Some(ku) = &ee.key_usage {
            if !ku.contains(&KU_DIGITAL_SIGNATURE) {
                e.warn("EE key usage", "digitalSignature is not set.", ee.ext_node);
            }
        }
        if ee.resources.has_any() {
            e.info("EE resources", describe_resources(&ee.resources), ee.ext_node);
        }
        if chain.is_empty() {
            e.skip("EE certificate signature", "Needs the issuing CA certificate. Provide a chain to check it.", ee.node);
        }
    }
    out.extend(e.checks);

    // Chain
    let mut anchored = false;
    let mut path: Vec<String> = ee.map(|c| vec![cert_label(c)]).unwrap_or_default();
    let mut ee_res = ee.map(|c| c.resources.clone());
    let mut resolved = false;
    if let (Some(ee), false) = (ee, chain.is_empty()) {
        let mut c = Rep::new("Chain");
        let pool = build_pool(chain, &mut c);
        let (p, a) = validate_path(&mut c, subject_of_cert(ee), &pool, now);
        anchored = a;
        path = p.iter().map(cert_label).collect();
        if p.len() > 1 {
            if let Some(eff) = check_path_resources(&mut c, &p) {
                ee_res = Some(eff);
            }
            resolved = true;
        }
        out.extend(c.checks);
    }

    // Payload
    let mut p = Rep::new("Content");
    if let Some(ec) = &obj.e_content {
        let content = match &obj.e_content_node {
            Some(n) => Ok(n.clone()),
            None => parse_bytes(ec),
        };
        let res = content.and_then(|content| match obj.e_content_type.as_str() {
            OID_ROA => check_roa(&mut p, &content, ee_res.as_ref(), resolved),
            OID_ASPA => check_aspa(&mut p, &content, ee_res.as_ref(), resolved),
            OID_MFT => check_manifest(&mut p, &content, ee, now),
            _ => Ok(()),
        });
        if let Err(err) = res {
            p.fail(format!("{} content", type_name), format!("Could not parse: {}", err), obj.e_content_node.as_ref().and_then(|n| n.id));
        }
    }
    out.extend(p.checks);
    Outcome { object_type: type_name, anchored, path }
}

fn verify_cert(cert: &Cert, chain: &[Vec<u8>], now: i64, out: &mut Vec<Check>) -> (bool, Vec<String>) {
    let mut r = Rep::new("Certificate");
    r.info("Object type", format!("X.509 v{} certificate for {}.", cert.version, cert.subject_name), cert.node);
    check_validity(&mut r, "Certificate", cert.not_before, cert.not_after, now, cert.validity_node);
    check_ski(&mut r, "Certificate", cert);
    if cert.resources.has_any() {
        r.info("Resources", describe_resources(&cert.resources), cert.ext_node);
    }
    if chain.is_empty() {
        let res = if is_self_issued(cert) {
            check_signature(&mut r, "Self-signature", &cert.key, &cert.sig_alg, &cert.tbs, &cert.signature, "its own public key", None, cert.node)
        } else {
            r.skip("Certificate signature", "Not self-signed, so the issuing CA certificate is needed. Provide a chain to check it.", cert.node);
            false
        };
        out.extend(r.checks);
        return (res, vec![cert_label(cert)]);
    }
    out.extend(r.checks);
    let mut c = Rep::new("Chain");
    let pool = build_pool(chain, &mut c);
    let (p, a) = validate_path(&mut c, subject_of_cert(cert), &pool, now);
    if p.len() > 1 {
        check_path_resources(&mut c, &p);
    }
    out.extend(c.checks);
    (a, p.iter().map(cert_label).collect())
}

fn verify_crl(crl: &Crl, chain: &[Vec<u8>], now: i64, out: &mut Vec<Check>) -> (bool, Vec<String>) {
    let mut r = Rep::new("CRL");
    let num = crl.crl_number.map(|n| format!(", number {}", n)).unwrap_or_default();
    r.info("Object type", format!("CRL issued by {}{}, {} revoked certificate(s).", crl.issuer_name, num, crl.revoked.len()), crl.node);
    check_crl_times(&mut r, "CRL", crl, now);
    if crl.aki.is_none() {
        r.warn("Authority key identifier", "Missing (required by the RPKI profile).", crl.node);
    }
    if chain.is_empty() {
        r.skip("CRL signature", "Needs the issuing CA certificate. Provide a chain to check it.", crl.node);
        out.extend(r.checks);
        return (false, vec![]);
    }
    out.extend(r.checks);
    let mut c = Rep::new("Chain");
    let pool = build_pool(chain, &mut c);
    let (p, a) = validate_path(&mut c, subject_of_crl(crl), &pool, now);
    if p.len() > 1 {
        check_path_resources(&mut c, &p);
    }
    out.extend(c.checks);
    (a, p.iter().map(cert_label).collect())
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/// Verify the object in `tree`. `chain` holds DER certificates and CRLs in any order,
/// `now_ms` is the reference time in milliseconds since the epoch.
pub fn verify_tree(tree: &Tree, chain: &[Vec<u8>], now_ms: i64) -> VerifyReport {
    let mut checks: Vec<Check> = vec![];
    let mut object_type = "unknown".to_string();
    let mut anchored = false;
    let mut path = vec![];

    let parsed = snapshot(tree, tree.root_id, true).and_then(|root| detect(&root));
    match parsed {
        Err(e) => checks.push(Check { group: "Structure".into(), title: "Parse object".into(), status: "fail", detail: Some(e), node: None }),
        Ok(Parsed::Signed(s)) => {
            let o = verify_signed(&s, chain, now_ms, &mut checks);
            object_type = o.object_type;
            anchored = o.anchored;
            path = o.path;
        }
        Ok(Parsed::Cert(c)) => {
            object_type = "Certificate".into();
            (anchored, path) = verify_cert(&c, chain, now_ms, &mut checks);
        }
        Ok(Parsed::Crl(c)) => {
            object_type = "CRL".into();
            (anchored, path) = verify_crl(&c, chain, now_ms, &mut checks);
        }
        Ok(Parsed::Csr(c)) => {
            object_type = "Certificate signing request".into();
            let mut r = Rep::new("CSR");
            r.info("Object type", format!("PKCS#10 request for {}.", c.subject_name), c.node);
            anchored = check_signature(&mut r, "Self-signature", &c.key, &c.sig_alg, &c.tbs, &c.signature, "the requested public key", None, c.node);
            checks.extend(r.checks);
        }
    }

    let failed = checks.iter().filter(|c| c.status == "fail").count();
    let warned = checks.iter().filter(|c| c.status == "warn").count();
    let verdict = if failed > 0 { "invalid" } else if anchored { "valid" } else { "unanchored" };
    let mut summary = if failed > 0 {
        format!("{} check(s) failed.", failed)
    } else if anchored {
        match (chain.is_empty(), path.last()) {
            (false, Some(ta)) => format!("Valid up to the trust anchor {}.", ta),
            _ => "Valid self-signed object.".into(),
        }
    } else if !chain.is_empty() {
        "All checks passed, but the chain does not end at a self-signed trust anchor.".into()
    } else {
        "All self-contained checks passed. Provide a certificate chain to verify the issuer path.".into()
    };
    if warned > 0 {
        summary += &format!(" {} warning(s).", warned);
    }
    VerifyReport { object_type, verdict, summary, checks, chain_provided: !chain.is_empty(), path }
}

/// Decode chain input: one or more PEM blocks, base64, hex or raw DER.
pub fn decode_chain_input(data: &[u8]) -> R<Vec<Vec<u8>>> {
    if data.first() == Some(&0x30) {
        return Ok(vec![data.to_vec()]);
    }
    let text = String::from_utf8_lossy(data);
    let text = text.trim();
    if text.is_empty() {
        return Ok(vec![]);
    }
    let b64 = |s: &str| -> R<Vec<u8>> {
        let clean: String = s.chars().filter(|c| !c.is_whitespace()).map(|c| match c { '-' => '+', '_' => '/', c => c }).collect();
        let mut clean = clean.trim_end_matches('=').to_string();
        while clean.len() % 4 != 0 {
            clean.push('=');
        }
        base64::decode(&clean).map_err(|e| format!("Invalid base64: {}", e))
    };
    if text.contains("-----BEGIN ") {
        let mut out = vec![];
        let mut rest = text;
        while let Some(start) = rest.find("-----BEGIN ") {
            let after = &rest[start + 11..];
            let label_end = after.find("-----").ok_or("Malformed PEM header")?;
            let label = &after[..label_end];
            let body_start = &after[label_end + 5..];
            let end_marker = format!("-----END {}-----", label);
            let end = body_start.find(&end_marker).ok_or("PEM block without END line")?;
            out.push(b64(&body_start[..end])?);
            rest = &body_start[end + end_marker.len()..];
        }
        return Ok(out);
    }
    let compact: String = text.chars().filter(|c| !c.is_whitespace()).collect();
    if compact.len() % 2 == 0 && compact.starts_with("30") && compact.chars().all(|c| c.is_ascii_hexdigit()) {
        return hex::decode(&compact).map(|v| vec![v]).map_err(|e| e.to_string());
    }
    Ok(vec![b64(&compact)?])
}
