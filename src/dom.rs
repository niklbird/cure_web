use std::{collections::HashMap, fs};

use cure_asn1::tree_parser::Tree;


// #[derive(Debug)]
// pub enum NodeType{
//     Null,
//     Integer,
//     OctetString,
//     OID,
//     Set,
//     Sequence,
//     BitString,
//     Implicit,
//     PrintableString    
// }

// impl NodeType{
//     // TODO
//     pub fn from_id(id: usize) -> NodeType{
//         match id{
//             0x00 => NodeType::Null,
//             0x02 => NodeType::Integer,
//             0x04 => NodeType::OctetString,
//             0x06 => NodeType::OID,
//             0x30 => NodeType::Sequence,
//             0x31 => NodeType::Set,
//             _ => NodeType::Null,
//         }
//     }
// }

// pub struct DOM{
//     pub nodes: HashMap<usize, Node>,
//     pub current_ind: usize,
// }

// impl DOM{
//     pub fn new() -> DOM{
//         DOM{
//             nodes: HashMap::new(),
//             current_ind: 0,
//         }
//     }

//     pub fn add_node(&mut self, typ: usize, content: String, parent: usize, label: Option<String>){
//         let node = Node{
//             id: self.current_ind,
//             children: Vec::new(),
//             node_type: NodeType::from_id(typ),
//             parent: Some(parent),
//             depth: 0,
//             content,
//             label,
//             content_raw: Vec::new(),
//         };
        
//         self.nodes.insert(node.id, node);
//         self.nodes.get_mut(&parent).unwrap().children.push(self.current_ind);


//         self.current_ind += 1;
//     }
// }

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Node{
    pub id: usize,
    pub tag: (u8, String, Vec<u8>), // Value, Display Value, Binary Value
    pub length: (usize, String, Vec<u8>), 
    pub content: (String, String, Vec<u8>), 
    pub children: Vec<usize>,
    pub parent: usize,
}



// impl ToString for Node{
//     fn to_string(&self) -> String{
//         let space = " ".repeat(self.depth * 2);

//         match self.node_type{
//             NodeType::Sequence => {
//                 return format!("{}{}  SEQUENCE  ({} Elements) ", space, self.label.as_deref().unwrap_or_default(), self.children.len());
//             }
//             NodeType::Set => {
//                 return format!("{}{}  SET  ({} Elements) ", space, self.label.as_deref().unwrap_or_default(), self.children.len());
//             }
//             _ => {}
//         }
//         format!("{}{}  {:?} {}", space, self.label.as_ref().map_or("", |v| v), self.node_type, self.content)
//     }
// }


pub fn encode_node(tree: &Tree, node_id: usize) -> Vec<Node>{
    let mut nodes = vec![];

    let token = &tree.tokens[&node_id];
    let (tag, length, content) = token.to_string_pretty();
    let node = Node{
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

pub fn print_node(node: &Node){
    println!("{}  {}  {}", node.tag.1, node.length.1, node.content.1);
}


pub fn example_dom(){
    let roa_raw = fs::read("example.roa").unwrap();
    let roa_con = cure_asn1::rpki::parse_rpki_object(&roa_raw, &cure_asn1::rpki::ObjectType::ROA);
    let tree = roa_con.unwrap().content;
    let nodes = encode_tree(&tree);
    let reduced = nodes[0..10].to_vec();

    let s = serde_json::to_string(&reduced).unwrap();
    fs::write("./nodes.json", s).unwrap();
}