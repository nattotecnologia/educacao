const crypto = require('crypto');
function decrypt(encryptedData) { 
  try { 
    const [saltHex, ivHex, tagHex, encrypted] = encryptedData.split(':'); 
    const salt = Buffer.from(saltHex, 'hex'); 
    const iv = Buffer.from(ivHex, 'hex'); 
    const tag = Buffer.from(tagHex, 'hex'); 
    const key = crypto.pbkdf2Sync(Buffer.from('47a6b9c8d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8', 'hex'), salt, 10000, 32, 'sha512'); 
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv); 
    decipher.setAuthTag(tag); 
    let decrypted = decipher.update(encrypted, 'hex', 'utf8'); 
    decrypted += decipher.final('utf8'); 
    return decrypted; 
  } catch(e) { 
    return 'ERROR: ' + e.message; 
  } 
} 
console.log('OpenRouter Key Decrypted:', decrypt('b56a2b85fb1c3996e538dcaccf09b416fa1c610edf377ec04b7e54bc54cb4be7dd2c3b03255d67fd8b59a341d0b1fa7a17b7efaa40f944269692a5da956c58c7:0d59736e51151603a2449dce9cf1fbaf:71c3b72d5ed8beb1ebf9a4a96c5a575f:aee63234d6b8c1a9fe7cbfb6297f15dad6582435ede338822063cf551f6faf7476908fef99bdec1f94e41879c46090d30850751c991c837b5a44dce829e776394199b68a15b8ad3b98'));
console.log('Evolution Key Decrypted:', decrypt('1db1ed23e74484a207b3ebe2a05fa1fe354d98e87382fe3fa647b65877021c8f63c65787b537193c9b2e9aec802431e5a4ccca6031e415f48ded383047a2200a:e7288d36c4225163468451a77508bef7:666b74f990efe4d1e8fa2b45b5d52f0c:d37ac51484a0f240af5768a5fa20126685b48b70b3527962a464735542f4b45e219e86d4d3fbe979a3696a23f8c1d0dea8e322988509104a5c7192fbc944c045d099fcf83d923cff8848d960351b2047f83d3ce26cd0b7937b5e624fc3100925bfa544932ca962b5de6a25c70eb137a71efa1d599588a2a99723e7da8a9b773dc8204aa7c6e0a63dada93cff5537eaed5af1055795fdd480b4aba727ce3bcd323d5593e3d882f7815a52503250dd7ca98f2753bcf33f0f10f4e0979c837bda57ce39807c3cd884c988784458d35ae360ef63b299259aea397a6acddb5ecfd426b184a018c5c131d590fa66c4fa27387d1b2c8e1d20d6b60a9ebc0a9b7f89163e64cc5d434d7c4da14f'));
