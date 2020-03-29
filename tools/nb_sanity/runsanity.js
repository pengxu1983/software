#!/home/benpeng/nbifweb_client/software/node/bin/node
var mysql           = require('mysql');
let querystring     = require('querystring');
let http            = require('http');
var moment          = require('moment');
let process         = require('process');
let cronJob         = require("cron").CronJob;
let child_process   = require('child_process');
let fs              = require('fs');
////////////////////
//checking function
////////////////////
let checkifalldone  = function(path,checknumber,result){
  child_process.exec('ls '+path+'/result.* -d',function(err,stdout,stderr){
    console.log(stdout);
    let lines = stdout.split('\n');
    lines.pop();
    console.log('result files');
    console.log(lines.length);
    for(let l=0;l<lines.length;l++){
    }
    if(lines.length ==  checknumber){
      let connection = mysql.createConnection({
        host     : 'atlvmysqldp19.amd.com',
        user     : 'nbif_ad',
        password : 'WqyaSp90*',
        database : 'nbif_management_db'
      });
      connection.connect(function(err){
        if(err) throw err;
      });
      let sql = 'update sanityshelves set result="'+stat+'",resultlocation="'+path+'" where codeline="'+result.codeline+'" and branch_name="'+result.branch_name+'" and shelve="'+result.shelve+'"'
      connection.end();
    }
  });
}
////////////////////
////////////////////
////////////////////
let cron_check = new cronJob('*/5 * * * * *',function(){
  console.log(moment().format('YYYYMMDDHHmmss'));
  let connection = mysql.createConnection({
    host     : 'atlvmysqldp19.amd.com',
    user     : 'nbif_ad',
    password : 'WqyaSp90*',
    database : 'nbif_management_db'
  });
  connection.connect(function(err){
    if(err) throw err;
  });
  let sql = '';
  sql += 'select * from sanityshelves where ';
  sql += 'result="NOTSTARTED"';
  let variants  = ['nbif_nv10_gpu','nbif_draco_gpu','nbif_et_0','nbif_et_1','nbif_et_2'];
  connection.query(sql,function(err1,result1){
    if(err1){
      console.log(err1);
    }
    let workspace = '/proj/cip_nbif_de_2/sanitycheck/'+result1[0].codeline+'.'+result1[0].branch_name+'.'+result1[0].username+'.'+result1[0].shelve;
    sql = 'update sanityshelves set result="RUNNING",resultlocation="'+workspace+'" where codeline="'+result1[0].codeline+'" and branch_name="'+result1[0].branch_name+'" and shelve="'+result1[0].shelve+'"';
    connection.query(sql,function(err2,result2)){
      if(err2){
        console.log(err2);
      }
      console.log('DB updated');
      connection.end();////END DB
    }
    //cleaning workspace
    if(fs.existsSync(workspace)){
      console.log(workspace+'.remove cleaning...');
      child_process.execSync('mv '+workspace+' '+workspace+'.remove');
      child_process.exec('bsub -P bif-shub1 -q normal -Is -J nbif_S_cln -R "rusage[mem=2000] select[type==RHEL7_64]" rm -rf '+workspace+'.remove',function(err2,stdout2,stderr2){
        console.log(workspace+'.remove clean done');
      });
    }
    for(let v=0;v<variants.length;v++){
      //create trees
      let treeRoot    = workspace+'/'+variants[v];
      let dcelabRoot  = workspace+'/'+variants[v]+'.dcelab';
      child_process.execSync('mkdir -p '+dcelabRoot);
      console.log(dcelabRoot+ ' created');
      child_process.execSync('mkdir -p '+treeRoot);
      console.log(treeRoot+ ' created');
      //cases sync tree script context
      let casesynctext      = '';
      casesynctext += '#!/tool/pandora64/bin/tcsh\n';
      casesynctext += 'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
      casesynctext += 'cd '+treeRoot+'\n';
      casesynctext += 'rm -rf ~/.jfrog/\n';
      casesynctext += '/home/benpeng/nbifweb_client/software/tools/rtlogin\n';
      casesynctext += 'p4_mkwa -codeline '+result1[0].codeline+' -branch_name '+result1[0].branch_name+'\n';
      casesynctext += 'p4 unshelve -s '+result1[0].shelve+'\n';
      fs.writeFileSync(treeRoot+'.sync.script',casesynctext,{
        encoding  : 'utf8',
        mode      : '0700',
        flag      : 'w'
      });
      //dcelab sync tree script context
      let dcelabsynctext      = '';
      dcelabsynctext += '#!/tool/pandora64/bin/tcsh\n';
      dcelabsynctext += 'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
      dcelabsynctext += 'cd '+dcelabRoot+'\n';
      dcelabsynctext += 'rm -rf ~/.jfrog/\n';
      dcelabsynctext += '/home/benpeng/nbifweb_client/software/tools/rtlogin\n';
      dcelabsynctext += 'p4_mkwa -codeline '+result1[0].codeline+' -branch_name '+result1[0].branch_name+'\n';
      dcelabsynctext += 'p4 unshelve -s '+result1[0].shelve+'\n';
      fs.writeFileSync(dcelabRoot+'.sync.script',dcelabsynctext,{
        encoding  : 'utf8',
        mode      : '0700',
        flag      : 'w'
      });
      //let runcasetext   = '';
      let buildtext     = '';
      buildtext += '#!/tool/pandora64/bin/tcsh\n';
      buildtext += 'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
      buildtext += 'cd '+treeRoot+'\n';
      buildtext += 'rt_login\n';
      buildtext += 'bootenv -v '+variants[v]+'\n';
      buildtext += 'dj -l build.log -DUVM_VERBOSITY=UVM_LOW -m4 -DUSE_VRQ -DCGM -DSEED=12345678 run_test -s nbiftdl demo_test_0_nbif_all_rtl -a execute=off\n';
      fs.writeFileSync(treeRoot+'.build.script',buildtext,{
        encoding  : 'utf8',
        mode      : '0700',
        flag      : 'w'
      });
      //run dcelab script
      let rundcelabtext = '';
      rundcelabtext += '#!/tool/pandora64/bin/tcsh\n';
      rundcelabtext += 'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
      rundcelabtext += 'cd '+dcelabRoot+'\n';
      rundcelabtext += '/home/benpeng/nbifweb_client/software/tools/rtlogin\n';
      rundcelabtext += 'rt_login\n';
      rundcelabtext += 'bootenv -v '+variants[v]+'\n';
      if(variants[v]  ==  'nbif_draco_gpu'){
        rundcelabtext += "dj -l "+dcelabRoot+"/dcelab.log"+" -e 'releaseflow::dropflow(:rtl_drop).build(:rhea_drop,:rhea_dc)' -DPUBLISH_BLKS=nbif_shub_wrap_algfx\n";
      }
      else{
        rundcelabtext += "dj -l "+dcelabRoot+"/dcelab.log"+" -e 'releaseflow::dropflow(:rtl_drop).build(:rhea_drop,:rhea_dc)' -DPUBLISH_BLKS=nbif_shub_wrap_gfx\n";
      }
      fs.writeFileSync(dcelabRoot+'.run.script',rundcelabtext,{
        encoding  : 'utf8',
        mode      : '0700',
        flag      : 'w'
      });
      let djregxfail    = /dj exited with errors/;
      let djregxpass    = /dj exited successfully/;
      //cases part
      console.log(variants[v] +' sync begin');
      let starttimecasesync = new moment();
      child_process.exec('bsub -P bif-shub1 -q normal -Is -J nbif_S_sy -R "rusage[mem=2000] select[type==RHEL7_64]" '+treeRoot+'.sync.script',{
        maxBuffer : 1024*1024*1024
      },function(err2,stdout2,stderr2){
        let endtimecasesync = new moment();
        console.log(variants[v] +' sync cost '+moment.duration(starttimecasesync.diff(endtimecasesync)).as('minutes')+' minutes');
        console.log(variants[v] +' sync done');
        if(err2){
          console.log(err2);
        }
        console.log(variants[v] +' build begin');
        child_process.exec('bsub -P bif-shub1 -q normal -Is -J nbif_S_bd -R "rusage[mem=5000] select[type==RHEL7_64]" '+treeRoot+'.build.script',{
          maxBuffer : 1024*1024*1024
        },function(err3,stdout3,stderr3){
          console.log(variants[v] +' build done');
          if(fs.existsSync(treeRoot+'/build.log')){
            let lines = fs.readFileSync(treeRoot+'/build.log','utf8').split('\n');
            lines.pop();
            for(let l=0;l<lines.length;l++){
              if(djregxpass.test(lines[l])){
                console.log(variants[v]+' build pass');
                fs.writeFileSync(workspace+'/'+variants[v]+'.BUILDPASS','',{
                  encoding  : 'utf8',
                  mode      : '0600',
                  flag      : 'w'
                });
                ////////////////////
                //RUN case
                ////////////////////
                for(let t=0;t<JSON.parse(result1[0].testlist).length;t++){
                  let runcasetext='';
                  runcasetext += '#!/tool/pandora64/bin/tcsh\n';
                  runcasetext += 'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
                  runcasetext += 'cd '+treeRoot+'\n';
                  runcasetext += 'rt_login\n';
                  runcasetext += 'bootenv -v '+variants[v]+'\n';
                  runcasetext += 'dj -l '+treeRoot+'/'+JSON.parse(result1[0].testlist)[t]+'.log -DUVM_VERBOSITY=UVM_LOW -m4 -DUSE_VRQ -DCGM -DSEED=12345678 run_test -s nbiftdl '+JSON.parse(result1[0].testlist)[t]+'_nbif_all_rtl -a run=only\n';
                  fs.writeFileSync(treeRoot+'.'+JSON.parse(result1[0].testlist)[t]+'.run.script',runcasetext,{
                    encoding  : 'utf8',
                    mode      : '0700',
                    flag      : 'w'
                  });
                  console.log(variants[v]+' '+JSON.parse(result1[0].testlist)[t]+' run begin');
                  child_process.exec('bsub -P bif-shub1 -q normal -Is -J nbif_S_rn -R "rusage[mem=5000] select[type==RHEL7_64]" '+treeRoot+'.'+JSON.parse(result1[0].testlist)[t]+'.run.script',{
                    maxBuffer : 1024*1024*1024
                  },function(err4,stdout4,stderr4){
                    if(err4){
                      console.log(err4);
                    }
                    console.log(variants[v]+' '+JSON.parse(result1[0].testlist)[t]+' run done');
                    if(fs.existsSync(treeRoot+'/'+JSON.parse(result1[0].testlist)[t]+'.log')){
                      let lines = fs.readFileSync(treeRoot+'/'+JSON.parse(result1[0].testlist)[t]+'.log','utf8').split('\n');
                      lines.pop();
                      for(let l=0;l<lines.length;l++){
                        if(djregxfail.test(lines[l])){
                          console.log(variants[v]+' '+JSON.parse(result1[0].testlist)[t]+' run fail');
                          fs.writeFileSync(workspace+'/result.'+variants[v]+'.'+JSON.parse(result1[0].testlist)[t]+'.RUNFAIL','',{
                            encoding  : 'utf8',
                            mode      : '0600',
                            flag      : 'w'
                          });
                          break;
                        }
                        if(djregxpass.test(lines[l])){
                          console.log(variants[v]+' '+JSON.parse(result1[0].testlist)[t]+' run pass');
                          fs.writeFileSync(workspace+'/result.'+variants[v]+'.'+JSON.parse(result1[0].testlist)[t]+'.RUNPASS','',{
                            encoding  : 'utf8',
                            mode      : '0600',
                            flag      : 'w'
                          });
                          break;
                        }
                      }
                      if(fs.existsSync(workspace+'/result.'+variants[v]+'.'+JSON.parse(result1[0].testlist)[t]+'.RUNPASS')){
                      }
                      else if(fs.existsSync(workspace+'/result.'+variants[v]+'.'+JSON.parse(result1[0].testlist)[t]+'.RUNFAIL')){
                      }
                      else{
                        console.log(variants[v]+' '+JSON.parse(result1[0].testlist)[t]+' run unknown');
                        fs.writeFileSync(workspace+'/result.'+variants[v]+'.'+JSON.parse(result1[0].testlist)[t]+'.RUNUNKNOWN','',{
                          encoding  : 'utf8',
                          mode      : '0600',
                          flag      : 'w'
                        });
                      }
                    }
                    else{
                      console.log(variants[v]+' '+JSON.parse(result1[0].testlist)[t]+' run unknown');
                      fs.writeFileSync(workspace+'/result.'+variants[v]+'.'+JSON.parse(result1[0].testlist)[t]+'.RUNUNKNOWN','',{
                        encoding  : 'utf8',
                        mode      : '0600',
                        flag      : 'w'
                      });
                    }
                  });
                }
                break;
              }
              if(djregxfail.test(lines[l])){
                console.log(variants[v]+'  build fail');
                fs.writeFileSync(workspace+'/'+variants[v]+'.BUILDFAIL','',{
                  encoding  : 'utf8',
                  mode      : '0600',
                  flag      : 'w'
                });
                ////////////////////
                //All case fails reports
                ////////////////////
                for(let t=0;t<JSON.parse(result1[0].testlist).length;t++){
                  console.log(variants[v]+' '+JSON.parse(result1[0].testlist)[t]+' build fail. not run');
                  fs.writeFileSync(workspace+'/result.'+variants[v]+'.'+JSON.parse(result1[0].testlist)[t]+'.BUILDFAIL','',{
                    encoding  : 'utf8',
                    mode      : '0600',
                    flag      : 'w'
                  });
                }
                break;
              }
            }
          }
        });
      });
      //dcelab part
      console.log(variants[v]+' dcelab sync begin');
      child_process.exec('bsub -P bif-shub1 -q normal -Is -J nbif_S_dcsy -R "rusage[mem=2000] select[type==RHEL7_64]" '+dcelabRoot+'.sync.script',{
        maxBuffer : 1024*1024*1024
      },function(err2,stdout2,stderr2){
        if(err2){
          console.log(err2);
        }
        console.log(variants[v]+' dcelab sync done');
        child_process.exec('bsub -P bif-shub1 -q normal -Is -J nbif_S_dcrn -R "rusage[mem=40000] select[type==RHEL7_64]" '+dcelabRoot+'.run.script',{
          maxBuffer : 1024*1024*1024
        },function(err3,stdout3,stderr3){
          console.log(variants[v]+' dcelab run done');
          if(err3){
            console.log(err3);
          }
          if(!fs.existsSync(dcelabRoot+"/dcelab.log")){
            console.log(variants[v]+' dcelab UNKNOWN');
            fs.writeFileSync(workspace+'/result.'+variants[v]+'.dcelab.RUNUNKNOWN','',{
              encoding  : 'utf8',
              mode      : '0600',
              flag      : 'w'
            });
          }
          else{
            let lines = fs.readFileSync(dcelabRoot+"/dcelab.log",'utf8').split('\n');
            for(let l=0;l<lines.length;l++){
              if(djregxpass.test(lines[l])){
                console.log(variants[v]+' dcelab PASS');
                fs.writeFileSync(workspace+'/result.'+variants[v]+'.dcelab.RUNPASS','',{
                  encoding  : 'utf8',
                  mode      : '0600',
                  flag      : 'w'
                });
                break;
              }
              if(djregxfail.test(lines[l])){
                console.log(variants[v]+' dcelab FAIL');
                fs.writeFileSync(workspace+'/result.'+variants[v]+'.dcelab.RUNFAIL','',{
                  encoding  : 'utf8',
                  mode      : '0600',
                  flag      : 'w'
                });
                break;
              }
            }
            if(fs.existsSync(workspace+'/result.'+variants[v]+'.dcelab.RUNFAIL')){
            }
            else if(fs.existsSync(workspace+'/result.'+variants[v]+'.dcelab.RUNPASS')){
            }
            else{
              console.log(variants[v]+' dcelab UNKNOWN');
              fs.writeFileSync(workspace+'/result.'+variants[v]+'.dcelab.RUNUNKNOWN','',{
                encoding  : 'utf8',
                mode      : '0600',
                flag      : 'w'
              });
            }
          }
        });
      });
    }
  });
  cron_check.stop();
},null,true,'Asia/Chongqing');
