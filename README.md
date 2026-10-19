# 🧬 CURE ASN.1 Web Parser for RPKI and Beyond

A fast, modern web-based ASN.1 parser and editor — built with a strong focus on RPKI but fully compatible with any BER/DER/CER-encoded ASN.1 objects.
Edit and encode ASN.1 objects without the need for complicated templates.


## ✨ Features

    🔍 ASN.1 Object Parsing
    Supports all major encoding rules: BER, DER, and CER — seamlessly decode any ASN.1 structure.

    📝 Live Editing
    Modify parsed objects in real time through the intuitive interface.

    ⚡ High Performance
    Built for speed and efficiency, even with large and complex structures.

    📦 RPKI Integration

        - Embed ASN.1 objects into a fully valid RPKI repository structure for testing.

        - Directly interact with RPKI relying parties (RPs) to validate your objects live.

    🌐 Web-Based Interface
    No installation required — accessible through your browser.

## 🚀 Use Cases

    - Validate custom RPKI objects in a real-world RP context.
    - Explore and debug arbitrary ASN.1 objects visually.
    - Test how changes in encoded data affect structure and meaning.
    - Quickly prototype and verify ASN.1 encodings for standards development.

## 📚 Tech Stack

    - Frontend: vue.js

    - Backend: Rust WASM

    - Encoding/Parsing: cure_asn1 for parsing, cure_pp for nesting objects, cure_daemon for testing objects

## 🤝 Contributions

This tool is in its alpha version and contributions are very welcome! Please open an issue or pull request if you’d like to add functionality, fix a bug, or improve performance/documentation.

## 📄 License

This project is licensed under the **GPL3 License**. See [LICENSE](LICENSE) for details.


