const crypto = require('crypto');
const masterKey = '47a6b9c8d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8';

function decrypt(encryptedData) { 
  try { 
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

console.log('Evolution Key Decrypted:', decrypt('b1000d162e5569e25d625f526a4641ea7d03794f353ab78627facb31f463eef2c760e6e95321d614b5deebe4d2304128e75ffe2fed2395b76553bad85d195f5d:62d2f3a1a14bc17958ea4873ac0fbecb:d4e5ca152c6b63b7c3df1114b37338be:0856480efa6397e1e7b2283242a91a8667d4fb9046582c0e4af92d73840fb41360d703'));
console.log('OpenRouter Key Decrypted:', decrypt('3e2a94175c4ad94ee167ce1af9fea2458d423dc3a9e8e1955fa75991ea76ed943ac06fd13e6f5602c3705cad8dcd5847002d4e178da45e034f6e3c5d80334a71:83dcbe6ac2db6ec9e5fd55df6cc4df44:d1223d6f97668fa64fdab0d87c7157cb:6b951be2a2535ed0c3863dd2a5a90fd18173184e97735b4a26cef4f34a1f274cc32802e6a3cf0c69865e8f0ffdf55cb7c03aa042ae98e0c06cf114f8a3a8d11dc5ec8aaa2a9071b3cd'));
