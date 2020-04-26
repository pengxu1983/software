#!/home/benpeng/nbifweb_client/software/node/bin/node
var mysql           = require('mysql');
let querystring     = require('querystring');
let http            = require('http');
var moment          = require('moment');
let process         = require('process');
let cronJob         = require("cron").CronJob;
let child_process   = require('child_process');
let fs              = require('fs');
let bsub1Gcln       = 'bsub -P GIONB-SRDC -q regr_high -Is -J nbif_C_cln -R "rusage[mem=1000] select[type==RHEL7_64]" ';
let bsub1Gsy        = 'bsub -P GIONB-SRDC -q regr_high -Is -J nbif_C_sy -R "rusage[mem=1000] select[type==RHEL7_64]" ';
let bsub5Grn        = 'bsub -P GIONB-SRDC -q regr_high -Is -J nbif_C_rn -R "rusage[mem=5000] select[type==RHEL7_64]" ';
let bsub30Grn       = 'bsub -P GIONB-SRDC -q regr_high -Is -J nbif_C_rn -R "rusage[mem=30000] select[type==RHEL7_64]" ';
let loginit         = function(){
  return '[LOG]['+moment().format('YYYY-MM-DD HH:mm:ss')+'] ';
};
let variants        = ['nbif_nv10_gpu','nbif_draco_gpu','nbif_et_0','nbif_et_1','nbif_et_2'];
let MASK            = {};
for(let v=0;v<variants.length;v++){
  MASK[variants[v]]={};
  MASK[variants[v]]['test']={};
  MASK[variants[v]]['task']={};
  MASK[variants[v]]['test']['demo_test_0']='yes';
  MASK[variants[v]]['test']['demo_test_1']='yes';
  MASK[variants[v]]['test']['demo_test_2']='yes';
  MASK[variants[v]]['task']['dcelab']='yes';
}//TODO
let djregxfail      = /dj exited with errors/;
let djregxpass      = /dj exited successfully/;
let syncregxpass    = /All syncs OK/;
console.log(loginit()+JSON.stringify(MASK));

let httpreq = function(hostname,port,path,method,data){
  let postData = querystring.stringify(data);
  
  let options = {
    hostname: hostname,
    port: port,
    path: path,
    method: method,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  let req = http.request(options, (res) => {
    //console.log(`STATUS: ${res.statusCode}`);
    //console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      //console.log(loginit()+'response data received');
      //console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
      //console.log(loginit()+'response end');
      //console.log('No more data in response.');
    });
  });
  
  req.on('error', (e) => {
    console.log(loginit()+'http error');
    console.error(`problem with request: ${e.message}`);
  });
  
  // Write data to request body
  req.write(postData);
  req.end();
};
let R = child_process.execSync('whoami',{
  encoding  : 'utf8'
}).split('\n');
let whoami=R[0];
console.log(loginit()+'whoami : '+R[0]);
let HOME            = '/proj/cip_nbif_dv_3/changelistcheck';
let checknumber     = 3;
let maxPS           = 20;
let runningtasks    = 0;
//let branchs         = ['nbif2_0_main'];
let refTrees        = [HOME+'/nbif.ref.main'];
let checkifdone     = function(resultlocation,stat,changelistobj){
  let overallstatus = 'PASS';
  let regx  = /FAIL/;
  for(let variantname in MASK){
    for(let kind  in  MASK[variantname]){
      for(let taskname in MASK[variantname][kind]){
        if(stat[variantname][taskname]  ==  ''){
          overallstatus = 'NOTDONE';
          break;
        }
      }
    }
  }
  if(overallstatus  ==  'NOTDONE'){
    return;
  }
  else{
    //all tasks done
    for(let variantname in MASK){
      for(let kind  in  MASK[variantname]){
        for(let taskname in MASK[variantname][kind]){
          if(regx.test(stat[variantname][taskname])){
            overallstatus = 'FAIL';
          }
        }
      }
    }
    //send email
    let mailbody  = '';
    for(let variantname in MASK){
    mailbody  +=  'variant : '+variantname+'\n';
      for(let kind  in  MASK[variantname]){
        for(let taskname in MASK[variantname][kind]){
          mailbody  +=  '  '+taskname+' is '+stat[variantname][taskname]+'\n';
        }
      }
    }
    child_process.exec('mutt Benny.Peng@amd.com -s [NBIF][SanityCheck]['+overallstat+'][codeline:'+changelistobj.codeline+'][branch_name:'+changelistobj.branch_name+'][changelist:'+changelistobj.changelist+'] < '+resultlocation+'/report',function(err,stdout,stderr){
    });
    httpreq('localhost','9001','/sanity/updatechangelist','POST',{
      codeline    : changelistobj.codeline,
      branch_name : changelistobj.branch_name,
      changelist  : changelistobj.changelistobj,
      resultlocation  : resultlocation,
      result      : overallstat,
      details     : JSON.stringify(stat)
    });
    if(overallstat=='PASS'){
      child_process.exec('bsub -P bif-shub2 -q regr_high -Is -J nbif_C_cln -R "rusage[mem=2000] select[type==RHEL7_64]" rm -rf '+resultlocation,function(err2,stdout2,stderr2){
        console.log(loginit()+resultlocation+' cleaned up');
      });
    }
    if(overallstat=='FAIL'){
      setTimeout(function(){
        child_process.exec('bsub -P bif-shub2 -q regr_high -Is -J nbif_C_cln -R "rusage[mem=2000] select[type==RHEL7_64]" rm -rf '+resultlocation,function(err2,stdout2,stderr2){
          console.log(loginit()+resultlocation+' cleaned up');
        });
      },24*3600*1000);
    }
  }
};
let cron_sync = new cronJob('0 0 * * * *',function(){
  for(let treeId  =0;treeId < refTrees.length;treeId++){
    let synctext  = '';
    synctext  +=  '#!/tool/pandora64/bin/tcsh\n';
    synctext  +=  'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
    synctext  +=  'cd '+refTrees[treeId]+'\n';
    synctext  +=  'bootenv\n';
    synctext  +=  'p4w sync_all\n';
    fs.writeFileSync(refTrees[treeId]+'.sync.script',synctext,{
      encoding  : 'utf8',
      mode      : '0700',
      flag      : 'w'
    });
    child_process.exec(refTrees[treeId]+'.sync.script',function(err1,stdout1,stderr1){
      if(err1){
        console.log(loginit()+err1);
      }
    });
  }
},null,true,'Asia/Chongqing');
let cron_clupdate = new cronJob('0 * * * * *',function(){
  //Get changelists
  for(let treeId  =0;treeId < refTrees.length;treeId++){
    //one tree
    //changelist get
    

    let text  ='';
    text += '#!/tool/pandora64/bin/tcsh\n';
    text += 'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
    text += 'cd '+refTrees[treeId]+'\n';
    text += 'p4 changes -m'+checknumber+' ...#head\n';
    fs.writeFileSync(refTrees[treeId]+'.catchCL.script',text,{
      encoding  : 'utf8',
      mode      : '0700',
      flag      : 'w'
    });
    let changelists =[];
    let R = child_process.execSync(refTrees[treeId]+'.catchCL.script',{
      encoding  : 'utf8',
    }).split('\n');
    //delete
    R.pop();
    let regx1   = /Change (\d+) on (\d+\/\d+\/\d+) by (\w+)@.*/;
    let regx2   = /(\w+)\/(\w+)@(\d+)/;
    let codeline ;
    let branch_name;
    if(fs.existsSync(refTrees[treeId]+'/configuration_id')){
      let lines = fs.readFileSync(refTrees[treeId]+'/configuration_id','utf8').split('\n');
      lines[0].replace(regx2,function(rs,$1,$2,$3){
        codeline  = $1;
        branch_name = $2;
      });
    }
    else{
      throw "no configuration_id";
    }
    for(let cl=0;cl<R.length;cl++){
      R[cl].replace(regx1,function(rs,$1,$2,$3){
        let oneCL = {
          changelist  : $1,
          submitdate  : $2,
          username    : $3,
          codeline    : codeline,
          branch_name : branch_name
        };
        //changelists.push(oneCL);
        httpreq('localhost','9001','/sanity/uploadchangelist','POST',oneCL);
      });
    }
    //console.log(changelists);
  }
},null,true,'Asia/Chongqing');
let cron_check = new cronJob('0 * * * * *',function(){
  let connection = mysql.createConnection({
    host     : 'atlvmysqldp19.amd.com',
    user     : 'nbif_ad',
    password : 'WqyaSp90*',
    database : 'nbif_management_db'
  });
  connection.connect(function(err1){
    console.log(loginit()+'connect started');
    if(err1){
      console.log(loginit()+err1);
      connection.end();
      console.log(loginit()+'connect ended');
    }
    //connected
    let sql = '';
    sql += 'select * from sanitychangelists where ';
    sql += 'result="NOTSTARTED"';
    connection.query(sql,function(err2,result2){
      if(err2){
        console.log(loginit()+err2);
        connection.end();
        console.log(loginit()+'connect ended');
      }
      console.log(loginit()+result2);
      if(result2.length ==  0){
        console.log(loginit()+'no changelist');
        connection.end();
        console.log(loginit()+'connect ended');
      }
      else if(runningtasks >= maxPS){
        console.log(loginit()+'overload');
        connection.end();
        console.log(loginit()+'connect ended');
      }
      else{
        console.log(loginit()+'changelist picked up');
        let stat={};
        for(let variantname in MASK){
          stat[variantname]={};
          for(let kind  in  MASK[variantname]){
            for(let taskname in MASK[variantname][kind]){
              stat[variantname][taskname]='';//TODO maybe some day we allow same task name under different kind
            }
          }
        }
        //start for one changelist
        let pickedupchangelist  = result2[0];
        let treeRoot    = HOME+'/'+pickedupchangelist.codeline+'.'+pickedupchangelist.branch_name+'.'+pickedupchangelist.changelist;
        let sqlupdate = 'update sanitychangelists set ';
        sqlupdate += 'result="RUNNING",resultlocation="'+treeRoot+'" where ';
        sqlupdate += 'codeline="'+pickedupchangelist.codeline+'" ';
        sqlupdate += 'and ';
        sqlupdate += 'branch_name="'+pickedupchangelist.branch_name+'" ';
        sqlupdate += 'and ';
        sqlupdate += 'changelist="'+pickedupchangelist.changelist+'" ';
        connection.query(sqlupdate,function(err3,result3){
        });
        connection.end();
        console.log(loginit()+'connect ended');
        if(fs.existsSync(treeRoot)){
          child_process.execSync('mv '+treeRoot+' '+treeRoot+'.rm');
          console.log(loginit()+' '+treeRoot+'.rm is being cleaned');
          child_process.exec(bsub1Gcln+'rm -rf '+treeRoot+'.rm',function(err3,stdout3,stderr3){
            if(err3){
              console.log(loginit()+err3);
            }
            console.log(loginit()+' '+treeRoot+'.rm cleaning is done');
          });
        }
        else{
          child_process.execSync('mkdir -p '+treeRoot);
          console.log(loginit()+treeRoot+' is created');
        }
        //sync tree
        let synctext  = '';
        synctext += '#!/tool/pandora64/bin/tcsh\n';
        synctext += 'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
        synctext += 'cd '+treeRoot+'\n';
        synctext += 'p4_mkwa -codeline '+pickedupchangelist.codeline+' -branch_name '+pickedupchangelist.branch_name+' -cl '+pickedupchangelist.changelist+'\n';
        fs.writeFileSync(treeRoot+'.sync.script',synctext,{
          encoding  : 'utf8',
          mode      : '0700',
          flag      : 'w'
        });
        let syncstarttime = new moment();
        console.log(loginit() + treeRoot+' sync started');
        child_process.exec(bsub1Gsy+treeRoot+'.sync.script > '+treeRoot+'.sync.log',function(err3,stdout3,stderr3){
          let syncendtime = new moment();
          console.log(loginit() + treeRoot+' sync done');
          console.log(loginit() + treeRoot+' sync cost '+moment.duration(syncendtime.diff(syncstarttime)).as('minutes')+' minutes');
          if(!fs.existsSync(treeRoot+'.sync.log')){
            console.log(loginit() + treeRoot+' sync fail');
            //sync fail
            fs.writeFileSync(treeRoot+'/nb__sync.FAIL','',{
              encoding  : 'utf8',
              mode      : '0600',
              flag      : 'w'
            });
            //all tasks fail
            for(let variantname in MASK){
              for(let kind  in  MASK[variantname]){
                for(let taskname in MASK[variantname][kind]){
                  console.log(loginit()+variantname+' '+taskname+' run done');
                  console.log(loginit()+variantname+' '+taskname+' sync fail');
                  fs.writeFileSync(treeRoot+'/result.'+variantname+'.'+taskname+'.SYNCFAIL','',{
                    encoding  : 'utf8',
                    mode      : '0600',
                    flag      : 'w'
                  });
                  //check result
                  stat[variantname][taskname]='SYNCFAIL';
                  console.log(loginit()+' stat is '+JSON.stringify(stat));
                }
              }
            }
          }
          else{
            let lines = fs.readFileSync(treeRoot+'.sync.log','utf8').split('\n');
            lines.pop();
            for(let l=0;l<lines.length;l++){
              if(syncregxpass.test(lines[l])){
                console.log(loginit() + treeRoot+' sync pass');
                fs.writeFileSync(treeRoot+'/nb__sync.PASS','',{
                  encoding  : 'utf8',
                  mode      : '0600',
                  flag      : 'w'
                });
                //sync pass
                for(let variantname in MASK){
                  for(let kind  in  MASK[variantname]){
                    for(let taskname in MASK[variantname][kind]){
                      let runtext = '';
                      runtext += '#!/tool/pandora64/bin/tcsh\n';
                      runtext += 'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
                      runtext += 'cd '+treeRoot+'\n';
                      runtext += 'bootenv -v '+variantname+' -out_anchor '+treeRoot+'/out.'+variantname+'.'+kind+'.'+taskname+'\n';
                      if(kind ==  'test'){
                        runtext += bsub5Grn+'dj -l '+treeRoot+'/nb__.'+variantname+'.run.'+taskname+'.log -DUVM_VERBOSITY=UVM_LOW -m4 -DUSE_VRQ -DCGM -DSEED=12345678 run_test -s nbiftdl '+taskname+'_nbif_all_rtl\n';
                      }
                      if(kind ==  'task'){
                        switch (taskname) {
                          case 'dcelab':
                            if(variantname  ==  'nbif_draco_gpu'){
                              runtext +=  bsub30Grn+"dj -l "+treeRoot+"/nb__."+variantname+".run."+taskname+".log"+" -e 'releaseflow::dropflow(:rtl_drop).build(:rhea_drop,:rhea_dc)' -DPUBLISH_BLKS=nbif_shub_wrap_algfx\n";
                            }
                            else{
                              runtext +=  bsub30Grn+"dj -l "+treeRoot+"/nb__."+variantname+".run."+taskname+".log"+" -e 'releaseflow::dropflow(:rtl_drop).build(:rhea_drop,:rhea_dc)' -DPUBLISH_BLKS=nbif_shub_wrap_gfx\n";
                            }
                            break;
                        }
                      }
                      fs.writeFileSync(treeRoot+'.'+variantname+'.run.'+taskname+'.script',runtext,{
                        encoding  : 'utf8',
                        mode      : '0700',
                        flag      : 'w'
                      });
                      let taskstarttime = new moment();
                      console.log(loginit()+variantname+' '+taskname+' run start');
                      child_process.exec(treeRoot+'.'+variantname+'.run.'+taskname+'.script',function(err4,stdout4,stderr4){
                        let taskendtime = new moment();
                        console.log(loginit()+variantname+' '+taskname+' run done');
                        console.log(loginit()+variantname+' '+taskname+' cost '+moment.duration(taskendtime.diff(taskstarttime)).as('minutes')+' minutes');
                        if(!fs.existsSync(treeRoot+'/nb__.'+variantname+'.run.'+taskname+'.log')){
                          console.log(loginit()+variantname+' '+taskname+' run fail');
                          fs.writeFileSync(treeRoot+'/result.'+variantname+'.'+taskname+'.RUNFAIL','',{
                            encoding  : 'utf8',
                            mode      : '0600',
                            flag      : 'w'
                          });
                          //check result
                          stat[variantname][taskname]='RUNFAIL';
                          console.log(loginit()+' stat is '+JSON.stringify(stat));
                        }
                        else{
                          let lines = fs.readFileSync(treeRoot+'/nb__.'+variantname+'.run.'+taskname+'.log','utf8').split('\n');
                          lines.pop();
                          for(let l=0;l<lines.length;l++){
                            if(djregxpass.test(lines[l])){
                              console.log(loginit()+variantname+' '+taskname+' run pass');
                              fs.writeFileSync(treeRoot+'/result.'+variantname+'.'+taskname+'.RUNPASS','',{
                                encoding  : 'utf8',
                                mode      : '0600',
                                flag      : 'w'
                              });
                              //check result
                              stat[variantname][taskname]='RUNPASS';
                              console.log(loginit()+' stat is '+JSON.stringify(stat));
                              break;
                            }
                            if(djregxfail.test(lines[l])){
                              console.log(loginit()+variantname+' '+taskname+' run fail');
                              fs.writeFileSync(treeRoot+'/result.'+variantname+'.'+taskname+'.RUNFAIL','',{
                                encoding  : 'utf8',
                                mode      : '0600',
                                flag      : 'w'
                              });
                              //check result
                              stat[variantname][taskname]='RUNFAIL';
                              console.log(loginit()+' stat is '+JSON.stringify(stat));
                              break;
                            }
                          }
                        }
                      });
                    }
                  }
                }
                break;
              }
            }
            if(!fs.existsSync(treeRoot+'/nb__sync.PASS')){
              console.log(loginit() + treeRoot+' sync fail');
              fs.writeFileSync(treeRoot+'/nb__sync.FAIL','',{
                encoding  : 'utf8',
                mode      : '0600',
                flag      : 'w'
              });
              //sync fail
              for(let variantname in MASK){
                for(let kind  in  MASK[variantname]){
                  for(let taskname in MASK[variantname][kind]){
                    console.log(loginit()+variantname+' '+taskname+' run done');
                    console.log(loginit()+variantname+' '+taskname+' sync fail');
                    fs.writeFileSync(treeRoot+'/result.'+variantname+'.'+taskname+'.SYNCFAIL','',{
                      encoding  : 'utf8',
                      mode      : '0600',
                      flag      : 'w'
                    });
                    //check result
                    stat[variantname][taskname]='RUNFAIL';
                    console.log(loginit()+' stat is '+JSON.stringify(stat));
                  }
                }
              }
            }
          }
        });
      }
    });
  });
},null,true,'Asia/Chongqing');
