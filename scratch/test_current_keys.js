const crypto = require('crypto');
const masterKey = '47a6b9c8d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8';

function decrypt(encryptedData) { 
  try { 
    if (!encryptedData || !encryptedData.includes(':')) return encryptedData;
    const [saltHex, ivHex, tagHex, encrypted] = encryptedData.split(':'); 
    const salt = Buffer.from(saltHex, 'hex'); 
    const iv = Buffer.from(ivHex, 'hex'); 
    const tag = Buffer.from(tagHex, 'hex'); 
    const key = crypto.pbkdf2Sync(Buffer.from(masterKey, 'hex'), salt, 10000, 32, 'sha512'); 
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv); 
    decipher.setAuthTag(tag); 
    let decrypted = decipher.update(encrypted, 'hex', 'utf8'); 
    decrypted += decipher.final('utf8'); 
    return decrypted; 
  } catch(e) { 
    return 'ERROR: ' + e.message; 
  } 
} 

console.log('Evolution Key Decrypted:', decrypt('65c75a255a169fc20c33bdb99bc01e710024cbbddfb7156dce20054e282909950e349caac584cf02a1db3a340401584135e41f13db8181c4fb4236bfcbb16ba2:4757d065f32bc1b00caa6202165ec9d2:c49f2ac96874bb0dd4ffc8c1ffdedefe:1aa3c4c46db371998974b5125446866d81f431a987596484bb6da6dedc4432605dac56'));
console.log('OpenRouter Key Decrypted:', decrypt('7ef0dc9aac8dac4c6c4f9ffdea0de070bf817e5be17f81f163f3fed5bd48f5d869a33a5d49766e4c37550eb9d99e663ca041af04014cad26eeebce3b616a0a0a:74e25b1f95a982d7fceeb343efb3471f:5e3ccb159f4a796249585710c10e5851:dd1e45fb1a9a160209cbcadfab1505f304f49da170ee80890cdad9c26ae82bde97fe533c0276d4a128cae1aaf19a6c80e1cd0b3dff4dd494901d7036d92ba956d4942f52761192f049a01388d76c8247097595e74bcc91f535cf8b02a97450f93c9143c6472c53811582b405046524bc257fb46ad7cd788bfe2dee892f1a390e25deb98d3d487d656befaced44b75215fbffba055ce11d79a45cad8315ed04a4088bf4c12043f4781078b5eaa800d0f82e52f57d008b15d1d41789374b47beaf6a0d23d2aaf11e5e37f490047b8fdd93879c138891b20678d14254bdaaa4189450fea91172393ebc5fcf26ad53c4c6c3602991c96bce678181dbf870360c27b256acd52aa2eddcaaa493c698d0e09ccaa1460465793ae5379a9f82f5f802c3c6ce54996e5e22b7facdfc2277b99810b8f101f1be02add635b7740a381d30958f8b103cdbe4686a80a353637982a69228f711291193'));
