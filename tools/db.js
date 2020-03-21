#!/home/benpeng/nbifweb_client/software/node/bin/node
var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : 'atlvmysqldp19.amd.com',
  user     : 'nbif_ad',
  password : 'WqyaSp90*',
  database : 'nbif_management_db'
});
 
connection.connect();
 
connection.query('SELECT * from regressiondetails', function (error, results, fields) {
  if (error) throw error;
  console.log(results);
});

