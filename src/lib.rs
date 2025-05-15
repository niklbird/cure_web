use chrono::Utc;
use cure_pp::{cure_object::CureObject, cure_repo::{self, new_repo}, repository_util::{self, load_random_key, random_fname}};
use regex::Regex;
use tar::Builder;
use wasm_bindgen::prelude::*;
use cure_asn1::{rpki::ObjectType, tree_parser::Tree};
use std::{fs, io::Cursor};

use flate2::write::GzEncoder;
use flate2::Compression;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Node{
    pub id: usize,
    pub label: String, 
    pub tag: (u8, String, Vec<u8>), // Value, Display Value, Binary Value
    pub length: (usize, String, Vec<u8>), 
    pub content: (String, String, Vec<u8>),  // 
    pub children: Vec<usize>,
    pub parent: usize,
}


pub fn encode_node(tree: &Tree, node_id: usize) -> Vec<Node>{
    let mut nodes = vec![];

    let token = &tree.tokens[&node_id];
    let (label, tag, length, content) = token.to_string_pretty();
    let node = Node{
        label,
        id: node_id,
        tag,
        length,
        content,
        children: token.children.clone(),
        parent: token.parent,
    };

    nodes.push(node);
    for child in token.children.iter(){
        nodes.extend(encode_node(tree, *child));
    }

    nodes
}

pub fn encode_tree(tree: &Tree) -> Vec<Node>{
    encode_node(tree, tree.root_id)
}

fn is_hex(s: &str) -> bool {
    let hex_regex = Regex::new(r"^(?:[0-9A-Fa-f]{2})+$").unwrap();
    hex_regex.is_match(s)
}

fn is_base64(s: &str) -> bool {
    let base64_regex = Regex::new(r"^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$").unwrap();
    base64_regex.is_match(s)
}

fn create_tar_gz_in_memory(files: Vec<(String, Vec<u8>)>) -> std::io::Result<Vec<u8>> {
    let buffer = Vec::new();
    let cursor = Cursor::new(buffer);
    
    // Wrap cursor in GzEncoder for gzip compression
    let encoder = GzEncoder::new(cursor, Compression::default());
    
    // Create tar archive builder on top of the encoder
    let mut tar = Builder::new(encoder);

    for (path, contents) in files {
        let mut header = tar::Header::new_gnu();
        header.set_path(&path)?;
        header.set_size(contents.len() as u64);
        header.set_mode(0o755);
        header.set_cksum();
        
        tar.append(&header, contents.as_slice())?;
    }

    // Finish writing the tar archive and get the inner Vec<u8>
    let encoder = tar.into_inner()?;     // Finish tar
    let cursor = encoder.finish()?;      // Finish gzip
    Ok(cursor.into_inner())              // Return the buffer
}

// fn create_zip_in_memory(files: Vec<(String, Vec<u8>)>) -> zip::result::ZipResult<Vec<u8>> {
//     let buffer = Vec::new();
//     let cursor = Cursor::new(buffer);
//     let mut zip = ZipWriter::new(cursor);

//     let options = FileOptions::default()
//         .compression_method(zip::CompressionMethod::Stored) // or .Deflated
//         .unix_permissions(0o755);

//     for (path, contents) in files {
//         zip.start_file(path, options)?;
//         zip.write_all(&contents)?;
//     }

//     let cursor = zip.finish()?;
//     Ok(cursor.into_inner()) // this gives you the Vec<u8>
// }


#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[wasm_bindgen]
pub struct RrdpEntry{
    uri: String,
    content: String,
}

#[wasm_bindgen]
impl RrdpEntry {
    #[wasm_bindgen(constructor)]
    pub fn new(uri: String, content: String) -> RrdpEntry {
        RrdpEntry { uri, content }
    }

    #[wasm_bindgen(getter)]
    pub fn uri(&self) -> String {
        self.uri.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn content(&self) -> String {
        self.content.clone()
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct State{
    tree: Tree, 
}

#[wasm_bindgen]
impl State{
    #[wasm_bindgen(constructor)]
    pub fn new(data: String) -> Result<State, String>{
        // Takes either hex or base64 encoded data is input
        let mut data = data.trim().to_string();
        if data.starts_with("0x"){
            data = data[2..].to_string();
        }

        if is_hex(&data) == false && is_base64(&data) == false{
            return Err("Invalid data".to_string());
        }

        let decoded;
        if is_hex(&data){
            decoded = hex::decode(&data).map_err(|_| "Invalid hex data".to_string());
        }
        else{
            decoded = base64::decode(&data).map_err(|_| "Invalid base64 data".to_string());
        }

        if decoded.is_err(){
            return Err(decoded.err().unwrap());
        }

        let tree = cure_asn1::interface::parse_tree(&decoded.unwrap(), "");

        if tree.is_none(){
            return Err("Invalid data".to_string());
        }

        Ok(State{
            tree: tree.unwrap(),
        }) 
    }

    #[wasm_bindgen]
    pub fn drag_node(&mut self, id: usize, new_parent: usize, child_index: usize) -> Result<(), String> 
    {
        if self.tree.tokens.get(&new_parent).is_none(){
            return Err("Invalid node".to_string());
        }

        if self.tree.tokens.get(&id).is_none(){
            return Err("Invalid node".to_string());
        }

        // Remove the node from its current parent
        if let Some(parent_token) = self.tree.tokens.get_mut(&self.tree.tokens[&id].parent.clone()) {
            parent_token.children.retain(|&child| child != id);
        }

        // Add the node to the new parent
        self.tree.tokens.get_mut(&new_parent).unwrap().children.insert(child_index, id);
        self.tree.tokens.get_mut(&id).unwrap().parent = new_parent;
        self.tree.taint_parents(id);
        self.tree.fix_sizes(true);
        Ok(())
    }



    
    #[wasm_bindgen]
    pub fn repositorify(&self) -> Vec<u8>{
        let (repo_files, tal, ca_cert) = self.into_rpki_repo();
        let mut files = repo_files.clone();
        files.push(("ta.tal".to_string(), tal));
        files.push(("data/repo/ta/ta.cer".to_string(), ca_cert));
        create_tar_gz_in_memory(files).unwrap_or_default()
    }

    // (Snapshot and Notification, TAL, CA Cert)
    fn into_rpki_repo(&self) -> (Vec<(String, Vec<u8>)>, Vec<u8>, Vec<u8>){
        // let rpki_object = RpkiObject::new(self.tree.clone(), self.tree.obj_type.clone());
        let parent_key;
        let mut repo;
        if self.tree.obj_type == "cer"{
            repo = cure_repo::new_parent_child();
            parent_key = repo.child_repos[0].certificate.parent_key.clone();
        }
        else{
            let conf = repository_util::RepoConfig::default();
            repo = new_repo(&conf, &ObjectType::UNKNOWN);

            parent_key = repo.certificate.child_key.clone();
        }

        let child_key = load_random_key(&repo.conf).1;
        let name = format!("{}.{}", random_fname(), self.tree.obj_type);

        let cure_obj = CureObject::new(
            ObjectType::from_string(&self.tree.obj_type),
            parent_key,
            child_key,
            self.tree.clone(),
            name,
        );


        if cure_obj.op_type.is_payload(){
            repo.payloads = vec![cure_obj];
        }
        else{
            match cure_obj.op_type{
                ObjectType::MFT => {
                    repo.manifest = cure_obj;
                }
                ObjectType::CRL => {
                    repo.crl = cure_obj;
                }
                ObjectType::CERTCA => {
                    repo.child_repos[0].certificate = cure_obj;
                    repo.child_repos[0].fix_all_objects(true);

                }
                _ => {}
            }
        } 

        repo.fix_all_objects(true);

        repo.conf.base_rrdp_dir_l = repo.conf.base_rrdp_dir.clone();
        let ret = repo.create_snapshot_notification(&repo.conf);
        // let mut ret_vec = vec![];
        // for (name, data) in ret{
        //     let s_data = from_utf8(&data).unwrap().to_string();
        //     ret_vec.push((name, s_data));
        // }
        (ret, repo.get_tal().as_bytes().to_vec(), repo.certificate.tree.encode())
    }


    #[wasm_bindgen]
    pub fn load_example(typ: &str) -> Result<State, String>{
        let conf = cure_pp::repository_util::create_default_config();
        let ob_typ = ObjectType::from_string(typ);
        if ob_typ == ObjectType::UNKNOWN{
            return Err("Invalid object type".to_string());
        }
        let obj = cure_pp::cure_object::new_object(&conf, &ob_typ);
        let state = State{tree: obj.tree};
        Ok(state)
    }


    #[wasm_bindgen]
    pub fn get_nodes(&self) -> String{
        let nodes = encode_tree(&self.tree);
        serde_json::to_string(&nodes).unwrap().clone()
    }

    #[wasm_bindgen]
    pub fn add_node(&mut self, typ: u8, value: String, parent: usize, label: String) -> Result<(), String>{
        if self.tree.tokens.get(&parent).is_none(){
            return Err("Invalid parent".to_string());
        }

        let val = val_to_bytes(typ, value)?;

        let label = if label.len() == 0{
            None
        }
        else{
            Some(label)
        };

        self.tree.add_node(typ, val, parent, label);
        Ok(())
    }

    #[wasm_bindgen]
    pub fn adapt_node_content(&mut self, id: usize, new_content: String) -> Result<(), String>{
        let val = val_to_bytes(self.tree.tokens[&id].tag_u, new_content.clone())?;
        self.tree.tokens.get_mut(&id).unwrap().data = val;
        self.tree.tokens.get_mut(&id).unwrap().manipulated = true;
        self.tree.tokens.get_mut(&id).unwrap().tainted = true;
        self.tree.taint_parents(id);
        self.tree.fix_sizes(true);

        Ok(())
    }

    #[wasm_bindgen]
    pub fn adapt_node_length(&mut self, id: usize, new_length: usize) -> Result<(), String>{
        self.tree.tokens.get_mut(&id).unwrap().visual_length = new_length;
        self.tree.tokens.get_mut(&id).unwrap().manipulated_length = true;
        self.tree.tokens.get_mut(&id).unwrap().manipulated = true;

        Ok(())
    }

    #[wasm_bindgen]
    pub fn adapt_node_tag(&mut self, id: usize, tag: u8) -> Result<(), String>{
        self.tree.tokens.get_mut(&id).unwrap().visual_tag = vec![tag];
        self.tree.tokens.get_mut(&id).unwrap().manipulated = true;

        Ok(())
    }

    #[wasm_bindgen]
    pub fn adapt_node_label(&mut self, id: usize, new_label: String) -> Result<(), String>{
        self.tree.tokens.get_mut(&id).unwrap().info = new_label.clone();
        self.tree.labels.insert(new_label.clone(), id);

        Ok(())
    }


    #[wasm_bindgen]
    pub fn remove_node(&mut self, id: usize) -> Result<(), String>{
        self.tree.taint_parents(id);
        self.tree.deep_delete(id);
        self.tree.fix_sizes(true);
        Ok(())
    }

    #[wasm_bindgen]
    pub fn export_bin(&self) -> Vec<u8>{
        self.tree.encode()
    }

    #[wasm_bindgen]
    pub fn export_base64(&self) -> String{
        base64::encode(self.tree.encode())
    }

    #[wasm_bindgen]
    pub fn encode_store(&self) -> String{
        serde_json::to_string(&self).unwrap()
    }

    #[wasm_bindgen]
    pub fn from_stored(encoded: String) -> Result<State, String>{
        let state: State = serde_json::from_str(&encoded).map_err(|_| "Invalid data".to_string())?;
        Ok(state)
    }
}

fn val_to_bytes(typ: u8, value: String) -> Result<Vec<u8>, String>{
    match typ{
        0x01 => { // Boolean
            let v = value.parse::<u8>();
            if v.is_err(){
                return Err("Invalid integer, only 0 - 255 allowed".to_string());
            }
            return Ok(vec![v.unwrap()]);

        }
        0x02 | 0x0A | 0x2A => { // Integer or Enumerated
            let v = value.parse::<i64>();

            if v.is_err(){
                return Err("Invalid integer".to_string());
            }
            return Ok(in_to_byt(v.unwrap()));
        }
        0x03 | 0x23 => { // BIT STRING
            let rev = value.chars().rev().collect::<String>();
            let mut ret_v = vec![];
            let mut padding = 0;

            for i in (0..rev.len()).step_by(8){
                let mut val = "".to_string();

                for j in 0..8{
                    let c = rev.chars().nth(i+j);

                    if c.is_none(){
                        padding += 1;
                        continue;
                    }

                    let c = c.unwrap();
                    if c != '0' && c != '1'{
                        return Err("Invalid bit string (Only 0 and 1 allowed)".to_string());
                    }
                    val.push(c);
                }

                let val = val.chars().rev().collect::<String>();
                let val = val + &"0".repeat(padding); // Add the padding

                let parsed = u8::from_str_radix(&val, 2).unwrap();
                ret_v.push(parsed);
            }

            let mut ret = vec![padding as u8]; // Bit strings start with the information how many bits are used as padding
            ret.extend(ret_v);
            return Ok(ret);

        }
        0x04 | 0x24 => { // OCTET STRING
            return parse_string_as_hex(&value);
        }
        0x05 | 0x25 => { // NULL
            if value.len() > 0{
                return Err("Invalid NULL value".to_string());
            }
            return Ok(vec![]);
        }
        0x06 | 0x26 => { // OBJECT IDENTIFIER
            let oid = encode_oid_from_string(&value);

            if oid.len() == 0{
                return Err("Invalid OID".to_string());
            }

            return Ok(oid);
        }
        0x09 | 0x29 => { // REAL
            let v = value.parse::<f64>();
            if v.is_err(){
                return Err("Invalid REAL value".to_string());
            }

            let val = v.unwrap();
            let val = val.to_be_bytes().to_vec();

            return Ok(val);

        }
        0x0E | 0x2E => { // TIME
            let parsed = chrono::DateTime::parse_from_rfc3339(&value)
            .map_err(|_| "Invalid ISO 8601 format. Example: 2025-02-12T14:30:00Z".to_string())?;
    
            let generalized_time_string = parsed.with_timezone(&Utc).format("%Y%m%d%H%M%SZ").to_string();
            return Ok(generalized_time_string.as_bytes().to_vec());

        }
        0x17 | 0x37 => { // UTC Time
            // 2025-02-10 11:21:43
            let parsed = chrono::DateTime::parse_from_str(&value, "%Y-%m-%d %H:%M:%S");
            if parsed.is_err(){
                return Err("Invalid date format. Required Format: %Y-%m-%d %H:%M:%S (E.g. 2025-01-30 11:21:43)".to_string());
            }
            let generalized_time_string = parsed.unwrap().to_utc().format("%Y%m%d%H%M%SZ").to_string();
            return Ok(generalized_time_string.as_bytes().to_vec());
        }
        0x18 | 0x38 => { // GeneralizedTime
            let parsed = chrono::DateTime::parse_from_str(&value, "%Y-%m-%d %H:%M:%S");
            if parsed.is_err(){
                return Err("Invalid date format. Required Format: %Y-%m-%d %H:%M:%S (E.g. 2025-01-30 11:21:43)".to_string());
            }
            let generalized_time_string = parsed.unwrap().to_utc().format("%y%m%d%H%M%SZ").to_string();
            return Ok(generalized_time_string.as_bytes().to_vec());
        }
        0x07 | 0x27 | 0x0C | 0x2C | 0x12..=0x16 | 0x32..=0x36 | 0x19 ..=0x1E | 0x39..=0x3E => { // String
            return Ok(value.as_bytes().to_vec());
        } 
        0x10 | 0x30 => { // Sequence
            return Ok(vec![]);
        }
        0x11 | 0x31 => { // Set
            return Ok(vec![]);
        }
        0x1F | 0x3F => { // Date
            let new_s = value.replace("-", "");
            return Ok(new_s.as_bytes().to_vec());
        }
        0x20 | 0x40 => { // Time of day
            let new_s = value.replace(":", "");

            return Ok(new_s.as_bytes().to_vec());
        }
        0x21 | 0x41 => { // Date-Time
            let new_s = value.replace("-", "").replace(":", "");
            return Ok(new_s.as_bytes().to_vec());
        }
        0x22 | 0x42 => { // Duration
            return encode_duration_iso8601(&value);
        }
        _ => { // Dont support external or embedded pdv 
            return Ok(value.as_bytes().to_vec());
        }
    };
}

fn parse_string_as_hex(value: &str)-> Result<Vec<u8>, String>{
    let mut trimmed = value.trim().to_string();
    if trimmed.starts_with("0x"){
        trimmed = trimmed[2..].to_string();
    }
    if trimmed.len() % 2 != 0{
        trimmed = ("0".to_string() + &trimmed).to_string();
    }

    let mut ret = vec![];
    for i in (0..trimmed.len()).step_by(2){
        let byte = u8::from_str_radix(&trimmed[i..i+2], 16);
        
        if byte.is_err(){
            return Err("Invalid hex string".to_string());
        }

        ret.push(byte.unwrap());
    }

    return Ok(ret);

}

fn in_to_byt(inp: i64) -> Vec<u8> {
    let mut result: Vec<u8> = vec![];
    let mut temp = inp;
    while temp > 0 {
        result.push((temp & 0xFF) as u8);
        temp >>= 8;
    }
    result.reverse();
    result
}

// pub fn test(){
//     let mut state = State::load_example("roa").unwrap();
//     // state.add_node(2, "1".to_string(), 0, "".to_string()).unwrap();
//     // state.adapt_node_tag(0, 43).unwrap();

//     // println!("{}: {}",state.into_rpki_repo()[0].uri(), state.into_rpki_repo()[0].content());
//     // println!("{}", base64::encode(state.tree.encode()));
//     let z = state.repositorify();
//     fs::write("test2.zip", z);
// }


pub fn encode_oid_from_string(oid_str: &str) -> Vec<u8> {
    let mut oid = vec![];
    for val in oid_str.trim().split('.'){
        let v = val.parse::<u32>();
        if v.is_err(){
            return vec![];
        }
        oid.push(v.unwrap());
    }

    if oid.len() < 3{
        return vec![];
    }

    let mut encoded = Vec::new();

    // First two components are combined as 40 * X + Y
    encoded.push(40 * oid[0] as u8 + oid[1] as u8);

    for &component in &oid[2..] {
        if component < 128 {
            encoded.push(component as u8);
        } else {
            let mut stack = Vec::new();
            let mut value = component;

            while value > 0 {
                stack.push((value & 0x7F) as u8);
                value >>= 7;
            }

            while let Some(byte) = stack.pop() {
                if stack.is_empty() {
                    encoded.push(byte);
                } else {
                    encoded.push(byte | 0x80);
                }
            }
        }
    }

    encoded
}


/// Parses an ISO 8601 duration string and encodes it into BER format
fn encode_duration_iso8601(value: &str) -> Result<Vec<u8>, String> {
    let re = Regex::new(r"^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$")
        .map_err(|_| "Regex compilation failed".to_string())?;
    
    if let Some(caps) = re.captures(value) {
        let years = caps.get(1).map_or(0, |m| m.as_str().parse::<i32>().unwrap_or(0));
        let months = caps.get(2).map_or(0, |m| m.as_str().parse::<i32>().unwrap_or(0));
        let days = caps.get(3).map_or(0, |m| m.as_str().parse::<i32>().unwrap_or(0));
        let hours = caps.get(4).map_or(0, |m| m.as_str().parse::<i32>().unwrap_or(0));
        let minutes = caps.get(5).map_or(0, |m| m.as_str().parse::<i32>().unwrap_or(0));
        let seconds = caps.get(6).map_or(0, |m| m.as_str().parse::<i32>().unwrap_or(0));

        // Create duration string in ASN.1 expected format
        let mut duration_str = String::new();
        if years > 0 {
            duration_str.push_str(&format!("{}Y", years));
        }
        if months > 0 {
            duration_str.push_str(&format!("{}M", months));
        }
        if days > 0 {
            duration_str.push_str(&format!("{}D", days));
        }
        if hours > 0 || minutes > 0 || seconds > 0 {
            duration_str.push('T');
            if hours > 0 {
                duration_str.push_str(&format!("{}H", hours));
            }
            if minutes > 0 {
                duration_str.push_str(&format!("{}M", minutes));
            }
            if seconds > 0 {
                duration_str.push_str(&format!("{}S", seconds));
            }
        }

        // Convert to BER encoding
        let mut ber_encoded = vec![0x1F, 0x22]; // ASN.1 Tag for DURATION
        ber_encoded.push(duration_str.len() as u8); // Length
        ber_encoded.extend_from_slice(duration_str.as_bytes()); // Value

        return Ok(ber_encoded);
    }
    
    Err("Invalid duration format".to_string())
}