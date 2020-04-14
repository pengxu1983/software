#!/home/benpeng/nbifweb_client/software/node/bin/node
var mysql           = require('mysql');
let querystring     = require('querystring');
let http            = require('http');
var moment          = require('moment');
let process         = require('process');
let cronJob         = require("cron").CronJob;
let child_process   = require('child_process');
let fs              = require('fs');
let R               = child_process.execSync('whoami',{
  encoding  : 'utf8'
}).split('\n');
let whoami=R[0];
console.log('whoami : '+R[0]);
let HOME            = '/proj/cip_nbif_de_1/sanitycheck/';
