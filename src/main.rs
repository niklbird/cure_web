use std::{fs::{self, File}, io::{Cursor, Write}};

use zip::{write::FileOptions, ZipWriter};

pub mod lib;

pub fn main(){
    lib::test();
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
//         zip.write_all(contents.as_bytes())?;
//     }

//     let cursor = zip.finish()?;
//     Ok(cursor.into_inner()) // this gives you the Vec<u8>
// }
// fn main() -> zip::result::ZipResult<()> {
    // Example input: (relative path, content)
    // let files = vec![
    //     ("folder1/file1.txt".to_string(), "Hello from file1!".to_string()),
    //     ("folder2/subfolder/file2.txt".to_string(), "Hello from file2!".to_string()),
    // ];
    // let z = create_zip_in_memory(files).unwrap();
    // fs::write("./test.zip", z).unwrap();

    // // Output zip file
    // let path = "output.zip";
    // let file = File::create(path)?;

    // let mut zip = ZipWriter::new(file);

    // // File options: compression, permissions, etc.
    // let options = FileOptions::default()
    //     .compression_method(zip::CompressionMethod::Stored) // or .Deflated
    //     .unix_permissions(0o755);

    // for (path, contents) in files {
    //     zip.start_file(path, options)?;
    //     zip.write_all(contents.as_bytes())?;
    // }

    // zip.finish()?;
    // println!("Created ZIP file: {}", path);

//     Ok(())
// }
