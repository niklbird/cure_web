export const asn1Types = {
    1: {
        name: "BOOLEAN",
        rules: (value) => value in ["TRUE", "FALSE"],
        example: "True",
        description: `
            ASN.1 BOOLEAN tag: 01

            The ASN.1 BOOLEAN type has two possible values: TRUE and FALSE. You can define new types based on this built-in type.
        `
    },
    2: {
        name: "INTEGER",
        rules: (value) => !isNaN(value),
        example: "35",
        description: `
            ASN.1 INTEGER tag: 02

            The INTEGER type value can be a positive or negative number. There are no limits imposed on the magnitude of INTEGER values in the ASN.1 standard.

            INTEGER types can also be used like enumerated types in C. In a type definition, the word "INTEGER" can be followed by a bracketed list of identifiers, each assigned to a particular INTEGER value. Each identifier must begin with a lowercase letter and may contain letters, digits, or hyphens. The named number list allows INTEGER values to convey a variety of meanings. Note that not all possible values must be defined in the list. You can assign names only to the first and last legal values, or to some other significant subset of the possibilities.
        `
    },
    3: {
        name: "BIT STRING",
        rules: (value) => {
            // Check if it's a binary string ('...'B)
            if (/^'[01]+'B$/.test(value)) return true;
            // Check if it's a hexadecimal string ('...'H)
            if (/^'[0-9A-F]+'H$/i.test(value)) return true;
            // Check if it's a named bit list ({...})
            if (/^\{([a-zA-Z0-9_]+(,\s*[a-zA-Z0-9_]+)*)?\}$/.test(value)) return true;
            return false;
        },
        example: "100101B",
        description: `
            ASN.1 BIT STRING tag: 03

            ASN.1 BIT STRING type values are arbitrary length strings of bits. A BIT STRING value doesn't need to be an even multiple of eight bits. Similar to INTEGERs, BIT STRING type definitions can include named bit lists. You can assign a meaning to each individual bit in the string (more than one value from the list can be present in a single BIT STRING value). BIT STRING values can be described as binary strings, hexadecimal strings, or using the identifiers from a BIT STRING's named bit list. A BIT STRING containing all zero bits can be expressed using empty curly brackets. 
        `
    },
    4: {
        name: "OCTET STRING",
        rules: (value) => {
            // Check if it's a binary string ('...'B)
            if (/^'[01]+'B$/.test(value)) return true;
            // Check if it's a hexadecimal string ('...'H)
            if (/^'[0-9A-F]+'H$/i.test(value)) return true;
            return false            
        },
        example: "A0F1H",
        description: `
            ASN.1 OCTET STRING tag: 04

            The ASN.1 OCTET STRING type contains arbitrary strings of octets. This type is very similar to BIT STRING, except that all values must be an integral number of eight bits. You can use constraints to specify a maximum length for an OCTET STRING type.
        `
    },
    5: { 
        name: "NULL",
        rules: (value) => value == "NULL",
        example: "NULL",
        description: `
        ASN.1 NULL tag: 05

        The ASN.1 NULL type is used when you need a placeholder for which there is no value. For example, it can be used to mark a currently empty space. The NULL type has only one possible value, also called NULL. 
    `
    },
    6: {
        name: "OBJECT IDENTIFIER",
        rules: (value) => {
            // Match OID format: a sequence of numbers separated by dots, starting with 0, 1, or 2
            if (/^(0|1|2)(\.\d+)+$/.test(value)) return true;
            return false;
        },
        example: "0.1222.32423",
        description: `
            ASN.1 OBJECT IDENTIFIER tag: 06

            The ASN.1 OBJECT IDENTIFIER type is used when you need to provide a unique identifier (for example, for a module).
        
            The possible values of OBJECT IDENTIFIERs are defined by reference to an object identifier tree beginning with three numbered branches coming from the root: branch 0, assigned to ITU-T (formerly CCITT), branch 1, assigned to ISO, and branch 2, a joint ISO-ITU-T branch. Below each of these branches are other numbered branches. This hierarchical organization allows unique names to be assigned to any number of objects.
        `
    },
    7: {
        name: "ObjectDescriptor",
        rules: () => true,
        example: "Example string",
        description: `
            ASN.1 ObjectDescriptor tag: 07

            The ASN.1 ObjectDescriptor type is similar to the GraphicString type; its value is expressed as a quoted string. 
        `
    },
    8: {
        name: "EXTERNAL",
        rules: () => true,
        example: "",
        description: `
            ASN.1 EXTERNAL tag: 08

            The ASN.1 EXTERNAL type was originally meant to be used for types that were defined externally. The intent was to use EXTERNAL to represent all data exchanged via the OSI Presentation Layer.

            The OSI presentation layer protocol defines mechanisms for negotiating pairs of abstract and transfer syntaxes to be used for communication. Each pair is called a presentation context. The protocol assigns a unique integer value to each active presentation context called the presentation context identifier (PCI). Data encoded using the EXTERNAL type may contain a PCI value (the presentation-context-id in the definition) identifying which presentation context this data belongs to. The context-negotiation is used mainly during the connection establishment phase to indicate the transfer syntax, and syntax is used to identify the abstract syntax that defines the type of the value in data-value. Once the connection has been fully established, the presentation-context-id is then used in values of the EXTERNAL type. In practice, the data-value-descriptor is rarely used. This definition of EXTERNAL is that of an "associated SEQUENCE type", and in BER and PER does not reflect how the values are actually encoded.

            The EMBEDDED PDV type was introduced in 1994 to replace the EXTERNAL type.
        `
    },
    9: {
        name: "REAL",
        rules: (value) => {
            // Check for special values
            if (value === "PLUS-INFINITY" || value === "MINUS-INFINITY") return true;
            // Check for a standard floating-point number
            if (!isNaN(value)) return true;
            // Check for the {mantissa, base, exponent} format
            if (/^\{(-?\d+),\s*(2|10),\s*-?\d+\}$/.test(value)) return true;
            // Check for the {mantissa X, base Y, exponent Z} format
            if (/^\{mantissa\s*-?\d+,\s*base\s*(2|10),\s*exponent\s*-?\d+\}$/.test(value)) return true;
            return false;
        },
        example: "3.1415",
        description: `
            ASN.1 REAL tag: 09

            The ASN.1 REAL type is used to represent real (floating point) values. The REAL type defines real values according to the formula m * be, where m is the mantissa, b the base (either 2 or 10), and e the exponent. The value notation for REALs must specify a value for each of these three parts. This is done by enclosing the values in curly brackets ( "{" and "}" ) in the order m, b, e, with the identifiers mantissa, base, exponent respectively.
        `
    },
    10: {
        name: "ENUMERATED",
        rules: (value, allowedValues) => {
            // ENUMERATED values must be in the predefined list of allowed values
            return allowedValues.includes(value);
        },
        example: "",
        description: `
            ASN.1 ENUMERATED tag: 10

            The ASN.1 ENUMERATED type is used to create a list of named items. It is similar to the INTEGER type, however, for ENUMERATED, the only values permitted are those identified by name in the list. For INTEGER, the named list is just a set of useful labels for specific numbers, and does not limit what values are permitted.
        `
    },
    11: {
        name: "EMBEDDED PDV",
        rules: () => true,
        example: "",
        description: `
            ASN.1 EMBEDDED PDV tag: 11

            The ASN.1 EMBEDDED PDV type replaces the EXTERNAL type. EMBEDDED PDV allows you to use a specific encoding for an abstract value while making the transfer syntax negotiation easier on the Presentation layer. The EMBEDDED PDV type is represented by a predefined SEQUENCE.         
        `
    },
    12: {
        name: "UTF8String",
        rules: () => true,
        example: "This is an UTF-8 string.",
        description: `
            ASN.1 UTF8String tag: 12

            The ASN.1 UTF8String type is used for handling Unicode characters. UniversalString and UTF8String both support the same character set, however, their encoding is different.
        `
    },
    13: {
        name: "RELATIVE-OID",
        rules: (value) => {
            // Must be a sequence of integers separated by dots (no leading 0s in components)
            return /^(\d+\.)*\d+$/.test(value);
        },
        example: "0.2.4",
        description: `
            ASN.1 RELATIVE-OID tag: 13

            The ASN.1 RELATIVE-OID type is represented by a series of integers, composing a path within the OID tree, but relative to the current OID root. 
        `
    },
    14: {
        name: "TIME",
        rules: (value) => {
            // ISO 8601 date, time, or datetime formats
            return /^(\d{4}-\d{2}-\d{2}|\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?)$/.test(value);
        },
        example: "14:30",
        description: `
            ASN.1 TIME tag: 14

            The ASN.1 TIME type fully supports ISO 8601 (the definitive standard for time and date representations). The main features of ISO 8601 are as follows:

                The identification of date only, of time of day (local time or UTC or both) only, and of date and time.
                The identification of time intervals using either a start and end point, a duration, or a duration with either a start or an end point.
                The concept of specifying a recurring time interval.

            The useful time types (DATE, TIME-OF-DAY, DATE-TIME) are defined as subsets of the TIME type.
        `
    },
    16: {
        name: "SEQUENCE",
        description: `
            ASN.1 SEQUENCE tag: 16

            In ASN.1, an ordered list of elements (or components) comprises a SEQUENCE. Using SEQUENCE, you can create a new type built from an arbitrary series of elements. Each element must identify its type, either by specifying a type name or by actually defining the element's type inline. Each element in the sequence must be assigned an identifier. Note that while all type names begin with upper case letters, any identifiers assigned to the elements must begin with a lower case letter. Identifiers have no effect on an encoded value of the type.
        `
    },
    17: {
        name: "SET",
        description: `
            ASN.1 SET tag: 17

            The ASN.1 SET type is similar to the SEQUENCE type. The key difference is that the elements in each value of a SEQUENCE type must appear in the order shown in the definition. The elements of a SET type value may appear in any order, regardless of how they are listed in the SET's definition, unless the encoding rule requires otherwise (for example, DER and PER). Note that defining a SET containing some elements of the same base type without element names can lead to ambiguity in the value notation.

            Using SET types can sometimes make implementation of encoding/decoding software more difficult; therefore it is recommended to use the SEQUENCE type whenever possible.
        `
    },
    18: {
        name: "NumericString",
        rules: (value) => /^[\d ]*$/.test(value),
        example: "20230 1231",
        description: `
            ASN.1 NumericString tag: 18

            The ASN.1 NumericString type is recommended when you need to use digits and spaces. 
        `
    },
    19: {
        name: "PrintableString",
        rules: (value) => /^[A-Za-z0-9.:,;!?]*$/.test(value),
        example: "This is a printable string.",
        description: `
            ASN.1 PrintableString tag: 19

            The ASN.1 PrintableString type supports upper case letters "A" through "Z", lower case letters "a" through "z", the digits "0" through "9", space, and common punctuation marks. Note that PrintableString does not support the "@", "&", and "*" characters.
        `
    },
    20: {
        name: "TeletexString",
        rules: () => true,
        example: "TeletexStrings are weird.",
        description: `
            ASN.1 TeletexString (T61String) tag: 20

            The ASN.1 TeletexString type supports characters defined in Recommendation T.61 for Teletex applications.
            
            The TeletexString type was originally created for supporting different character sets which could be printed by Teletex machine. It uses special "escape" characters to switch to different character sets. This type should be avoided since UTF8String, BMPString or UniversalString cover all character sets without needing to "escape" into different character sets.
        `
    },
    21: {
        name: "VideotexString",
        rules: () => true,
        example: "VideotexStrings are also weird.",
        description: `
            ASN.1 VideotexString tag: 21

            The ASN.1 VideotexString type supports T.100/T.101 characters. This type is no longer used.
        `
    },
    22: {
        name: "IA5String",
        rules: () => true,
        example: "ASCII only string.",
        description: `
            ASN.1 IA5String tag: 22

            The ASN.1 IA5String type uses 7-bit characters. It is equivalent to the ASCII alphabet.
        `
    },
    23: {
        name: "UTCTime",
        rules: (value) => {
            // Matches "YYMMDDhhmm[ss]Z" or "YYMMDDhhmm[ss](+|-)hhmm"
            return /^(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])([0-5]\d)([0-5]\d)?(Z|[+-](0\d|1[0-3])[0-5]\d)$/.test(value);
        },
        example: "8804152030Z", //(April 15, 1988, 20:30 UTC)
        description: `
            ASN.1 UTCTime tag: 23

            The ASN.1 UTCTime type is similar to the VisibleString type (their encoding is identical), however, it has a more restricted format, as follows: a UTCTime string value contains a two-digit year, a two-digit month, a two-digit day, a two-digit hour, and a two-digit minute. Optionally, a two-digit second can be added. The string ends with an uppercase Z ("YYMMDDhhmm[ss]Z"). For example, for "8:30 p.m. on April 15, 1988", the resulting string (with seconds omitted) is "8804152030Z". Instead of ending with a Z, the string may end with a "+" or "-", followed by a two-digit hour and two-digit minute. Instead of indicating UTC time, the first part of the string represents local time, and the final characters indicate the differential from UTC time. To represent the local time "8:30 p.m. on April 15, 1988" in an area 6 hours behind UTC time, "8804152030-0600" is used.
            
            Because a two-digit year is used (rather than a four-digit year), there might be ambiguity regarding which century is being represented by the date. Therefore, it is recommended to use DATE, TIME-OF-DAY, or DATE-TIME types instead of UTCTime.
        `
    },
    24: {
        name: "GeneralizedTime",
        rules: (value) => {
            // Matches "YYYYMMDDHH[MM[SS[.fff]]]" optionally followed by "Z" or "+/-hhmm"
            return /^(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])([0-5]\d)?([0-5]\d(\.\d{1,3})?)?(Z|[+-](0\d|1[0-3])[0-5]\d)?$/.test(value);
        },
        example: "19880415203000Z", // (April 15, 1988, 20:30 UTC)
        description: `
        ASN.1 GeneralizedTime tag: 24

        The ASN.1 GeneralizedTime type consists of strings of digits and certain characters, and provides three ways of describing time:
        
            Local time can be described as a four-digit year, a two digit month, a two-digit day, a two-digit hour (based on a twenty four hour clock) a two-digit minute, and a two-digit second with a decimal point and digit ("YYYYMMDDHH[MM[SS[.fff]]]"). For example, "8:30 p.m. on April 15, 1988" is represented by the string "19880415203000.0".
            Coordinated Universal Time (UTC time) can be described as a string of the form described above followed by an uppercase "Z", which indicates that the value is UTC time rather than local time.
            A value described as in the first case may be followed by an indication of the differential from UTC time. For example, the string "19880415203000.0-0600" represents "8:30 p.m. on April 15, 1988", but also indicates that this local time is 6 hours behind UTC time.
        
        Although a four-digit year is used and some potential ambiguities are removed, it is recommended to use DATE, TIME-OF-DAY, or DATE-TIME types instead of GeneralizedTime, as they fully support ISO 8601, the definitive standard for time and date representations.
    `
    },
    25: {
        name: "GraphicString",
        rules: () => true,
        example: "Just another string type.",
        description: `
            ASN.1 VisibleString tag: 26

            The ASN.1 VisibleString type supports a subset of ASCII characters that does not include control characters.
        `
    },
    26: {
        name: "VisibleString",
        rules: (value) => /^[\x20-\x7E]*$/.test(value),
        example: "Ascii without control characters.",
        description: `
            ASN.1 VisibleString tag: 26

            The ASN.1 VisibleString type supports a subset of ASCII characters that does not include control characters.
        `
    },
    27: {
        name: "GeneralString",
        rules: () => true,
        example: "Do we need anymore string types?",
        description: `
            ASN.1 GeneralString tag: 27

            The ASN.1 GeneralString type is the broadest of the ASN.1 defined string types. It may contain any characters from a "G" and "C" set of any standardized character sets.
        
            Similar to the GraphicString type, GeneralString is too general to be implemented, therefore it is not recommended. The following types can be used instead: UTF8String, BMPString, or UniversalString.
        `
    },
    28: {
        name: "UniversalString",
        rules: () => true,
        example: "Seems like we do.",
        description: `
            ASN.1 UniversalString tag: 28

            The ASN.1 UniversalString type supports characters drawn from from ISO 10646. These are four-byte characters, and are not recommended for use unless properly subtyped. This type did not gain popularity, and it is often replaced with UTF8String.
        `
    },
    29: {
        name: "CHARACTER STRING",
        rules: () => true,
        example: "This one is different. I think.",
        description: `
            ASN.1 CHARACTER STRING tag: 29

            The ASN.1 CHARACTER STRING type allows the definition of character sets to be deferred until runtime. This set of characters can be negotiated, and carries characters defined in any abstract syntax. The set of abstract characters is not statically defined. The abstract syntax may belong to the presentation context set allocated in an instance of communication or can be directly referenced when using the CHARACTER STRING type. The CHARACTER STRING type is represented by a predefined SEQUENCE.
        `
    },
    30: {
        name: "BMPString",
        rules: (value) => typeof value === "string" && /^[\\u0000-\\uFFFF]*$/.test(value),
        example: "Unicode strings",
        description: `
            ASN.1 BMPString tag: 30

            The ASN.1 BMPString type contains UNICODE characters. They are two-byte characters, and are not recommended for use unless properly subtyped.
        `
    },
    31: {
        name: "DATE",
        rules: (value) => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value),
        example: "2020-12-24",
        description: `
            ASN.1 DATE tag: 31

            The ASN.1 DATE type consists of a string value that has the form "YYYY-MM-DD", which represents a calendar date. 
        `
    },
    32: {
        name: "TIME-OF-DAY",
        rules: (value) => /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value),
        example: "11:35:33",
        description: `
            ASN.1 TIME-OF-DAY tag: 32

            Time types are derived from the character string type VisibleString. Their value notation is the same as that for VisibleString. The ASN.1 TIME-OF-DAY type is used to represent a particular time of day. Values have the form "HH:MM:SS".
        `
    },
    33: {
        name: "DATE-TIME",
        rules: (value) => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value),
        example: "2025-02-13T08:30:00",
        description: `
            ASN.1 DATE-TIME tag: 33

            The ASN.1 DATE-TIME type is used to represent a date and time value. Values have the form "YYYY-MM-DDTHH:MM:SS".
        `
    },
    34: {
        name: "DURATION",
        rules: (value) => /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/.test(value),
        example: "P1Y2M3DT4H5M6S",
        description: `
            ASN.1 DURATION tag: 34

            The ASN.1 DURATION type is defined as a subset of the TIME type. The DURATION type is used to represent a particular time interval. 
        `
    }

}