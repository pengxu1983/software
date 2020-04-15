#!/home/benpeng/nbifweb_client/software/node/bin/node
var mysql           = require('mysql');
let querystring     = require('querystring');
let http            = require('http');
var moment          = require('moment');
let process         = require('process');
let cronJob         = require("cron").CronJob;
let child_process   = require('child_process');
let fs              = require('fs');
let rtloginstart    = moment().add(30,'seconds');
let rtlogintime     = {
  s : rtloginstart.format('ss'),
  m : rtloginstart.format('mm'),
};
console.log(rtlogintime);
let maxPS           = 20;
let maxPSperson     = 2;
let overallusage    = {};
let djregxfail      = /dj exited with errors/;
let djregxpass      = /dj exited successfully/;
let syncregxpass    = /All syncs OK/;
let resolvefail     = /resolve skipped/;
let R               = child_process.execSync('whoami',{
  encoding  : 'utf8'
}).split('\n');
let whoami=R[0];
console.log('whoami : '+R[0]);
let HOME            = '/proj/cip_nbif_de_1/sanitycheck';
let variants        = ['nbif_nv10_gpu','nbif_draco_gpu','nbif_et_0','nbif_et_1','nbif_et_2'];//TODO pick up from DB in the future
let runningtasks    = 0;
/////////////////////////
//rt_login
/////////////////////////
let cron_rtlogin = new cronJob(rtlogintime.s+' '+rtlogintime.m+' * * * *',function(){
  cron_check.stop();
  child_process.exec('~/nbifweb_client/software/tools/rtlogin',function(err,stdout,stderr){
    if(err) {
      throw err;
    }
    let regx  = /you must use a password/;
    if(regx.test(stdout)){
      console.log(stdout);
      cron_check.start();
    }
    else{
      child_process.execSync('rm -rf /home/benpeng/.jfrog/');
      child_process.exec('~/nbifweb_client/software/tools/rtlogin',function(err1,result1,stderr1){
        if(err1) {
          child_process.execSync('mutt Benny.Peng@amd.com -s [NBIF][Sanity][RTLOGINFAIL]');
          throw err1;
        }
        if(regx.test(stdout)){
          cron_check.start();
        }
        else{
          child_process.execSync('mutt Benny.Peng@amd.com -s [NBIF][Sanity][RTLOGINFAIL]');
          throw 'need fix';
        }
      });
    }
  });
},null,true,'Asia/Chongqing');
/////////////////////////
//=======================
/////////////////////////

/////////////////////////
//Check shelve
/////////////////////////
let cron_check = new cronJob('*/5 * * * * *',function(){
  //let totaltasks  = 0;
  //for(let user in overallusage){
  //  totaltasks  +=  overallusage[user];
  //}
  //if(totaltasks >= maxPS){
  //  console.log('total task running is :'+totaltasks);
  //  console.log('next round');
  //  return;
  //}
  console.log('total task running is : '+runningtasks);
  console.log('usage details : '+JSON.stringify(overallusage));
  if(runningtasks >= maxPS){
    console.log('next round');
    return;
  }
  let details       = {};
  let treeRoot      = '';
  let username      = '';
  let shelve        = '';
  let codeline      = '';
  let branch_name   = '';
  let resultlocation= '';
  let numberofresult;
  let connection = mysql.createConnection({
    host     : 'atlvmysqldp19.amd.com',
    user     : 'nbif_ad',
    password : 'WqyaSp90*',
    database : 'nbif_management_db'
  });
  connection.connect(function(err){
    if(err) {
      console.log(err);
      return;
    }
    //DB connection succeed
    let sql = '';
    sql +=  'select * from sanityshelves  where result="NOTSTARTED"';
    //sql +=  ' and ';
    for(let username in overallusage){
      if(overallusage[username] >= maxPSperson){
        sql += ' and ';
        sql += 'username!="'+username+'"';
      }
    }
    connection.query(sql,function(err1,result1){
      if(err1){
        console.log(err1);
        return;
      }
      //pick up one result
      if(result1.length == 0){
        console.log('no new shelve submitted');
      }
      else{
        console.log('new shelve(s) found');
        let pickedupshelve;
        pickedupshelve  = result1[0];
        if(overallusage.hasOwnProperty(pickedupshelve.username)){
          overallusage[pickedupshelve.username]++;
        }
        else{
          overallusage[pickedupshelve.username]=1;
        }
        runningtasks++;
        console.log('running tasks changes to '+runningtasks);
        console.log('username who catched this slot is '+pickedupshelve.username);
        console.log('current username overall usage is '+overallusage[pickedupshelve.username]);
        numberofresult  = JSON.parse(pickedupshelve.testlist).length  * variants.length + variants.length * 1;//1 for dcelab
        console.log('[LOG]'+pickedupshelve.shelve + ' : tasks number to check is '+numberofresult);
        treeRoot  = HOME+'/'+pickedupshelve.codeline+'.'+pickedupshelve.branch_name+'.'+pickedupshelve.username+'.'+pickedupshelve.shelve;
        let updatesql ='';
        updatesql +=  'update sanityshelves set ';
        updatesql +=  'result="RUNNING",';
        updatesql +=  'resultlocation="'+treeRoot+'" ';
        updatesql +=  'where ';
        updatesql +=  'codeline="'+pickedupshelve.codeline+'" and ';
        updatesql +=  'branch_name="'+pickedupshelve.branch_name+'" and ';
        updatesql +=  'shelve="'+pickedupshelve.shelve+'"';
        connection.query(updatesql,function(err2,result2){
          if(err2){
            console.log('[LOG]'+pickedupshelve.shelve + ' : '+err2);
          }
          console.log('[LOG]'+pickedupshelve.shelve + ' : '+'DB update');
        });
        connection.end();
        if(fs.existsSync(treeRoot)){
          console.log('[LOG]'+pickedupshelve.shelve + ' : '+treeRoot+'.rm is cleanning');
          child_process.execSync('mv '+treeRoot+' '+treeRoot+'.rm');
          child_process.execSync('rm -rf '+treeRoot+'.*.script');
          child_process.execSync('rm -rf '+treeRoot+'.*.log');
          child_process.exec('bsub -P bif-shub2 -q regr_high -Is -J nbif_S_cln -R "rusage[mem=2000] select[type==RHEL7_64]" rm -rf '+treeRoot+'.rm',function(err2,stdout2,stderr2){
            if(err2){
              console.log('[LOG]'+pickedupshelve.shelve +' : '+err2);
            }
            console.log('[LOG]'+pickedupshelve.shelve + ' : '+treeRoot+'.rm cleanning done');
          });
        }
        child_process.execSync('mkdir -p '+treeRoot);
        console.log('[LOG]'+pickedupshelve.shelve + ' : '+treeRoot+' created');
        let synctext  = '';
        synctext += '#!/tool/pandora64/bin/tcsh\n';
        synctext += 'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
        synctext += 'cd '+treeRoot+'\n';
        synctext += 'p4_mkwa -codeline '+pickedupshelve.codeline+' -branch_name '+pickedupshelve.branch_name+'\n';
        let resolvetext = '';
        resolvetext += '#!/tool/pandora64/bin/tcsh\n';
        resolvetext += 'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
        resolvetext += 'cd '+treeRoot+'\n';
        resolvetext += 'bootenv\n';
        resolvetext += 'p4w unshelve -s '+pickedupshelve.shelve+'\n';
        resolvetext += 'p4w resolve -am\n';
        resolvetext += 'p4w sync_all\n';
        resolvetext += 'p4w resolve -am\n';

        fs.writeFileSync(treeRoot+'.sync.script',synctext,{
          encoding  : 'utf8',
          mode      : '0700',
          flag      : 'w'
        });
        console.log('[LOG]'+pickedupshelve.shelve + ' : '+'sync script made');
        fs.writeFileSync(treeRoot+'.resolve.script',resolvetext,{
          encoding  : 'utf8',
          mode      : '0700',
          flag      : 'w'
        });
        console.log('[LOG]'+pickedupshelve.shelve + ' : '+'resolve script made');
        let syncstarttime = new moment();
        console.log('[LOG]'+pickedupshelve.shelve + ' : '+'sync started at '+moment().format('YYYY/MM/DD HH:mm:ss'));
        child_process.exec(treeRoot+'.sync.script > '+treeRoot+'.sync.log',function(err2,stdout2,stderr2){
          if(err2){
            console.log('[LOG]'+pickedupshelve.shelve + ' : '+err2);
          }
          let syncendtime = new moment();
          console.log('[LOG]'+pickedupshelve.shelve + ' : '+'sync done at '+moment().format('YYYY/MM/DD HH:mm:ss'));
          console.log('[LOG]'+pickedupshelve.shelve + ' : '+'sync costs '+moment.duration(syncendtime.diff(syncstarttime)).as('minutes') + ' minutes');
          let lines = fs.readFileSync(treeRoot+'.sync.log','utf8').split('\n');
          lines.pop();
          for(let l =0;l<lines.length;l++){
            if(syncregxpass.test(lines[l])){
              fs.writeFileSync(treeRoot+'/nb__sync.PASS','',{
                encoding  : 'utf8',
                mode      : '0600',
                flag      : 'w'
              });
              break;
            }
          }
          if(!fs.existsSync(treeRoot+'/nb__sync.PASS')){
            //sync fail
            console.log('[LOG]'+pickedupshelve.shelve + ' : '+'sync fail');
            fs.writeFileSync(treeRoot+'/nb__sync.FAIL','',{
              encoding  : 'utf8',
              mode      : '0600',
              flag      : 'w'
            });
            for(let v=0;v<variants.length;v++){
              console.log('[LOG]'+pickedupshelve.shelve + ' : '+'dcelab run done');
              console.log('[LOG]'+pickedupshelve.shelve + ' : '+'dcelab sync fail');
              //dcelab
              fs.writeFileSync(treeRoot+'/result.dcelab.SYNCFAIL','',{
                encoding  : 'utf8',
                mode      : '0600',
                flag      : 'w'
              });
              //cases
              for(let t=0;t<JSON.parse(pickedupshelve.testlist).length;t++){
                console.log('[LOG]'+pickedupshelve.shelve + ' : '+'test '+JSON.parse(pickedupshelve.testlist)[t]+' run done');
                console.log('[LOG]'+pickedupshelve.shelve + ' : '+'test '+JSON.parse(pickedupshelve.testlist)[t]+' sync fail');
                fs.writeFileSync(treeRoot+'/result.'+JSON.parse(pickedupshelve.testlist)[t]+'.SYNCFAIL','',{
                  encoding  : 'utf8',
                  mode      : '0600',
                  flag      : 'w'
                });
              }
            }
          }
          else{
            //sync pass
            //to resolve
            console.log('[LOG]'+pickedupshelve.shelve + ' : '+'resolve started at '+moment().format('YYYY/MM/DD HH:mm:ss'));
            child_process.exec(treeRoot+'.resolve.script > '+treeRoot+'/nb__resolve.log',function(err2,stdout2,stderr2){
              if(err2) {
                console.log('[LOG]'+pickedupshelve.shelve + ' : '+err2);
                return;
              }
              console.log('[LOG]'+pickedupshelve.shelve + ' : '+'resolve done');
              let lines = fs.readFileSync(treeRoot+'/nb__resolve.log','utf8').split('\n');
              lines.pop();
              for(let l=0;l<lines.length;l++){
                if(resolvefail.test(lines[l])){
                  console.log('[LOG]'+pickedupshelve.shelve + ' : '+'resolve fail');
                  fs.writeFileSync(treeRoot+'/nb__resolve.FAIL','',{
                    encoding  : 'utf8',
                    mode      : '0600',
                    flag      : 'w'
                  });
                  for(let v=0;v<variants.length;v++){
                    console.log('[LOG]'+pickedupshelve.shelve + ' : '+'variant : '+variants[v]+' dcelab run done');
                    console.log('[LOG]'+pickedupshelve.shelve + ' : '+'variant : '+variants[v]+' dcelab resolve fail');
                    //dcelab
                    fs.writeFileSync(treeRoot+'/result.'+variants[v]+'.dcelab.RESOLVEFAIL','',{
                      encoding  : 'utf8',
                      mode      : '0600',
                      flag      : 'w'
                    });
                    //cases
                    for(let t=0;t<JSON.parse(pickedupshelve.testlist).length;t++){
                      console.log('[LOG]'+pickedupshelve.shelve + ' : '+'variant : '+variants[v]+' test '+JSON.parse(pickedupshelve.testlist)[t]+' run done');
                      console.log('[LOG]'+pickedupshelve.shelve + ' : '+'variant : '+variants[v]+' test '+JSON.parse(pickedupshelve.testlist)[t]+' resolve fail');
                      fs.writeFileSync(treeRoot+'/result.'+variants[v]+'.'+JSON.parse(pickedupshelve.testlist)[t]+'.RESOLVEFAIL','',{
                        encoding  : 'utf8',
                        mode      : '0600',
                        flag      : 'w'
                      });
                    }
                  }
                  break;
                }
              }
              if(!fs.existsSync(treeRoot+'/nb__resolve.FAIL')){
                //resolve pass
                console.log('[LOG]'+pickedupshelve.shelve + ' : '+'resolve pass');
                fs.writeFileSync(treeRoot+'/nb__resolve.PASS','',{
                  encoding  : 'utf8',
                  mode      : '0600',
                  flag      : 'w'
                });
                /////////////////////////
                // Per variant
                /////////////////////////

                for(let v=0;v<variants,length;v++){
                  //dcelab ============
                  //===================
                  let dcelabruntext= '';
                  dcelabruntext += '#!/tool/pandora64/bin/tcsh\n';
                  dcelabruntext += 'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
                  dcelabruntext += 'cd '+treeRoot+'\n';
                  dcelabruntext += 'bootenv -v '+variants[v]+' -out_anchor out.'+variants[v]+'.dcelab\n';
                  if(variants[v]  ==  'nbif_draco_gpu'){
                    dcelabruntext += "dj -l "+treeRoot+"/nb__."+variants[v]+".run.dcelab.log"+" -e 'releaseflow::dropflow(:rtl_drop).build(:rhea_drop,:rhea_dc)' -DPUBLISH_BLKS=nbif_shub_wrap_algfx\n";
                  }
                  else{
                    dcelabruntext += "dj -l "+treeRoot+"/nb__."+variants[v]+".run.dcelab.log"+" -e 'releaseflow::dropflow(:rtl_drop).build(:rhea_drop,:rhea_dc)' -DPUBLISH_BLKS=nbif_shub_wrap_gfx\n";
                  }
                  fs.writeFileSync(treeRoot+'.run.dcelab.'+variants[v]+'.script',dcelabruntext,{
                    encoding  : 'utf8',
                    mode      : '0700',
                    flag      : 'w'
                  });
                  console.log('[LOG]'+pickedupshelve.shelve + ' : '+'variant : '+variants[v]+' dcelab script made');
                  //build =============
                  //===================
                  let buildtext= '';
                  buildtext += '#!/tool/pandora64/bin/tcsh\n';
                  buildtext += 'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
                  buildtext += 'cd '+treeRoot+'\n';
                  buildtext += 'bootenv -v '+variants[v]+' -out_anchor out.'+variants[v]+'.tests\n';
                  buildtext += 'dj -l nb__.'+variants[v]+'.build.log -DUVM_VERBOSITY=UVM_LOW -m4 -DUSE_VRQ -DCGM -DSEED=12345678 run_test -s nbiftdl demo_test_0_nbif_all_rtl -a execute=off\n';
                  
                  fs.writeFileSync(treeRoot+'.build.'+variants[v]+'.script',buildtext,{
                    encoding  : 'utf8',
                    mode      : '0700',
                    flag      : 'w'
                  });
                  console.log('[LOG]'+pickedupshelve.shelve + ' : '+'variant : '+variants[v]+' build script made');
                  for(let t=0;t<JSON.parse(pickedupshelve.testlist)[t];t++){
                  }
                }
                /////////////////////////
                // Per variant done
                /////////////////////////
              }
            });
          }
        });
      }
    });
    /////////////////////////
    //Start main task
    /////////////////////////
  });
  cron_check.stop();
},null,false,'Asia/Chongqing');
/////////////////////////
//=======================
/////////////////////////
