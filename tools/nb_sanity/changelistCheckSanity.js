#!/home/benpeng/nbifweb_client/software/node/bin/node
var mysql           = require('mysql');
let querystring     = require('querystring');
let http            = require('http');
var moment          = require('moment');
let process         = require('process');
let cronJob         = require("cron").CronJob;
let child_process   = require('child_process');
let fs              = require('fs');
let R = child_process.execSync('whoami',{
  encoding  : 'utf8'
}).split('\n');
let whoami=R[0];
console.log('whoami : '+R[0]);
let HOME            = '/proj/cip_nbif_de_1/sanitychangelistcheck';
let checknumber     = 3;
//let branchs         = ['nbif2_0_main'];
let refTrees        = ['/proj/cip_nbif_de_1/sanitychangelistcheck/nbif.ref.main'];
let checkifalldone  = function(path,checknumber,result,stat){
  child_process.exec('ls '+path+'/result.* -d',function(err,stdout,stderr){
    console.log(stdout);
    let lines = stdout.split('\n');
    lines.pop();
    console.log('result files');
    console.log(lines.length);
    let overallstat ='PASS';
    let email = '';
    let regx  = /FAIL/;
    for(let variantname in stat){
      for(let taskname in stat[variantname]){
        if(regx.test(stat[variantname][taskname])){
          overallstat = 'FAIL';
          break;
        }
      }
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
      //let sql = 'update sanityshelves set details=\''+JSON.stringify(stat)+'",resultlocation="'+path+'\',result="'+overallstat+'" where codeline="'+result.codeline+'" and branch_name="'+result.branch_name+'" and shelve="'+result.shelve+'" and username="'+result.username+'"';
      let sql = 'update sanitychangelists set details=\''+JSON.stringify(stat)+'",resultlocation="'+path+'\',result="'+overallstat+'" where codeline="'+result.codeline+'" and branch_name="'+result.branch_name+'" and changelist="'+result.changelist+'"';
      connection.query(sql,function(err1,stdout1,stderr1){
        if(err1) {
          console.log(result.changelist+ ' ' +err1);
        }
      });
      connection.end();
      let lines = fs.readFileSync('/home/benpeng/p4users','utf8').split('\n');
      lines.pop();
      let regx  = /(\S+) <(\S+)>/;
      for(let l=0;l<lines.length;l++){
        if(regx.test(lines[l])){
          lines[l].replace(regx,function(rs,$1,$2){
            if($1 ==  result.username){
              email = $2;
              console.log(result.changelist+' email '+email);
            }
          });
        }
      }
      let mailbody  = '';
      mailbody  +=  '\n';
      mailbody  +=  'Hi '+result.username+'\n';
      mailbody  +=  '   Sanity check of :\n';
      mailbody  +=  '   codeline     :'+result.codeline+'\n';
      mailbody  +=  '   branch_name  :'+result.branch_name+'\n';
      mailbody  +=  '   changelist   :'+result.changelist+'\n';
      //mailbody  +=  '   shelve       :'+result.shelve+'\n';
      //mailbody  +=  '   host         :'+result.hostname+'\n';
      //mailbody  +=  '   treeRoot     :'+result.treeRoot+'\n';
      mailbody  +=  '   overall status is :\n';
      mailbody  +=  '      '+overallstat+'\n';
      if(overallstat  ==  'FAIL'){
        mailbody  +=  '   detailed status is :\n';
        for(let variantname in stat){
          mailbody  +=  '   '+variantname+':\n';
          for(let taskname  in stat[variantname]){
            mailbody  +=  '     '+taskname+' : '+stat[variantname][taskname]+'\n';
            mailbody  +=  '     see log: http://logviewer-atl/'+HOME+'/'+result.codeline+'.'+result.branch_name+'.'+result.username+'.'+result.changelist+'/'+variantname+'\n';
          }
          mailbody  +=  '\n';
        }
      }
      fs.writeFileSync(path+'/report',mailbody,{
        encoding  : 'utf8',
        mode      : '0600',
        flag      : 'w'
      });
      child_process.exec('mutt Benny.Peng@amd.com -s [NBIF][SanityCheck]['+overallstat+'][codeline:'+result.codeline+'][branch_name:'+result.branch_name+'][changelist:'+result.changelist+'] < '+path+'/report',function(err,stdout,stderr){
        if(err){
          console.log(err);
        }
        console.log(result.changelist+' Email send to '+result.email);
        //let reverttext  = '';
        //reverttext += 'cd '+path+'\n';
        //reverttext += 'p4 revert ...\n';
        //fs.writeFileSync(path+'.revert.script',reverttext,{
        //  encoding  : 'utf8',
        //  mode      : '0700',
        //  flag      : 'w'
        //});
        child_process.exec('bsub -P bif-shub2 -q regr_high -Is -J nbif_S_cln -R "rusage[mem=2000] select[type==RHEL7_64]" rm -rf '+path+'.remove',function(err,stdout,stderr){
        });
        //if(overallstat  ==  'PASS'){
        //  //child_process.execSync(path+'.revert.script');
        //  child_process.execSync('mv '+path+' '+path+'.remove');
        //  child_process.exec('bsub -P bif-shub2 -q regr_high -Is -J nbif_S_cln -R "rusage[mem=2000] select[type==RHEL7_64]" rm -rf '+path+'.remove',function(err,stdout,stderr){
        //  });
        //}
        //else{
        //  setTimeout(function(){
        //    child_process.execSync(path+'.revert.script');
        //    child_process.exec('bsub -P bif-shub2 -q regr_high -Is -J nbif_S_cln -R "rusage[mem=2000] select[type==RHEL7_64]" rm -rf '+path+'.remove',function(err,stdout,stderr){
        //    });
        //  },24*3600*1000);
        //}
      });
    }
  });
}
let cron_check = new cronJob('30 * * * * *',function(){
  //Get changelists
  for(let treeId  =0;treeId < refTrees.length;treeId++){
    //one tree
    //changelist get
    
    let text  ='';
    text += '#!/tool/pandora64/bin/tcsh\n';
    text += 'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
    text += 'cd '+refTrees[treeId]+'\n';
    text += 'p4 changes -m'+checknumber+' ...#head\n';
    fs.writeFileSync(refTrees[treeId]+'.script',text,{
      encoding  : 'utf8',
      mode      : '0700',
      flag      : 'w'
    });
    let changelists =[];
    let R = child_process.execSync(refTrees[treeId]+'.script',{
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
        changelists.push({
          changelist  : $1,
          submitdate  : $2,
          username    : $3,
          codeline    : codeline,
          branch_name : branch_name
        });
      });
    }
    console.log(changelists);
    for(let c=0;c<changelists.length;c++){
      let sql= 'select * from sanitychangelists where ';
      sql += 'changelist="'+changelists[c].changelist+'"';
      sql += ' and ';
      sql += 'codeline="'+changelists[c].codeline+'"';
      sql += ' and ';
      sql += 'branch_name="'+changelists[c].branch_name+'"';
      let connection = mysql.createConnection({
        host     : 'atlvmysqldp19.amd.com',
        user     : 'nbif_ad',
        password : 'WqyaSp90*',
        database : 'nbif_management_db'
      });
      connection.connect(function(err){
        if(err) {
          connection.connect(function(err1){
            if(err1) throw err1;
          })
        }
        connection.query(sql,function(err1,stdout1,stderr1){
          if(err1){
            console.log(err1);
          }
          if(stdout1.length ==  0){
            sql = "insert into sanitychangelists (codeline,branch_name,changelist,username,result,resultlocation,details,testlist,createdAt,updatedAt) values ("+"'"+changelists[c].codeline+"',"+"'"+changelists[c].branch_name+"',"+"'"+changelists[c].changelist+"',"+"'"+changelists[c].username+"','NOTSTARTED','NA','NA','"+JSON.stringify(['demo_test_0','demo_test_1','demo_test_2'])+"','"+moment().format("x")+"','"+moment().format("x")+"')";
            connection.query(sql,function(err2,stdout2,stderr2){
              if(err2) throw err2;
              console.log('created ');
              connection.end();
            });
          }
          else{
            console.log('no action');
            connection.end();
          }
        });
      });
    }
  }
},null,true,'Asia/Chongqing');
let cron_runsanity = new cronJob('*/5 * * * * *',function(){
  let stat  = {};
  //console.log(moment().format('YYYYMMDDHHmmss'));
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
  sql += 'select * from sanitychangelists where ';
  sql += 'result="NOTSTARTED"';
  //sql += ' and ';
  //sql += 'username="'+whoami+'"';
  let variants  = ['nbif_nv10_gpu','nbif_draco_gpu','nbif_et_0','nbif_et_1','nbif_et_2'];
  let numberofresult ;
  let finishedreport =0;
  connection.query(sql,function(err1,result1){
    if(err1){
      console.log(err1);
    }
    if(result1.length ==  0){
      connection.end();
      return;
    }
    console.log(result1);
    //numberofresult  = variants.length + variants.length * JSON.parse(result1[0].testlist).length;
    numberofresult  = 20;
    console.log(result1[0].changelist+' reports number '+numberofresult);
    let workspace = HOME+'/'+result1[0].codeline+'.'+result1[0].branch_name+'.'+result1[0].username+'.'+result1[0].changelist;
    //sql = 'update sanityshelves set result="RUNNING",resultlocation="'+workspace+'" where codeline="'+result1[0].codeline+'" and branch_name="'+result1[0].branch_name+'" and shelve="'+result1[0].shelve+'" and username="'+result1[0].username+'"';
    sql = 'update sanitychangelists set result="RUNNING",resultlocation="'+workspace+'" where codeline="'+result1[0].codeline+'" and branch_name="'+result1[0].branch_name+'" and changelist="'+result1[0].changelist+'"';
    connection.query(sql,function(err2,result2){
      if(err2){
        console.log(err2);
      }
      console.log('DB updated');
      connection.end();////END DB
    });
    //cleaning workspace
    if(fs.existsSync(workspace)){
      console.log(workspace+'.remove cleaning...');
      child_process.execSync('mv '+workspace+' '+workspace+'.remove');
      child_process.exec('bsub -P bif-shub2 -q regr_high -Is -J nbif_S_cln -R "rusage[mem=2000] select[type==RHEL7_64]" rm -rf '+workspace+'.remove',function(err2,stdout2,stderr2){
        console.log(workspace+'.remove clean done');
      });
    }
    //let rtlogintext ='';
    //rtlogintext += '#!/tool/pandora64/bin/tcsh\n';
    //rtlogintext += 'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
    //rtlogintext += '/home/benpeng/nbifweb_client/software/tools/rtlogin\n';
    //child_process.execSync('mkdir -p '+workspace);
    //fs.writeFileSync(workspace+'/rtlogin.script',rtlogintext,{
    //  encoding  : 'utf8',
    //  mode      : '0700',
    //  flag      : 'w'
    //});
    //child_process.execSync(workspace+'/rtlogin.script');
    for(let v=0;v<variants.length;v++){
      stat[variants[v]]={};
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
      //casesynctext += 'rm -rf ~/.jfrog/\n';
      //casesynctext += '/home/benpeng/nbifweb_client/software/tools/rtlogin\n';
      //casesynctext += 'rt_login\n';
      casesynctext += 'p4_mkwa -codeline '+result1[0].codeline+' -branch_name '+result1[0].branch_name+' -cl '+result1[0].changelist+'\n';
      //casesynctext += 'p4 unshelve -s '+result1[0].shelve+'\n';
      //casesynctext += 'p4 resolve -am\n';
      //casesynctext += 'bootenv -v '+variants[v]+'\n';
      //casesynctext += 'p4w sync_all\n';
      //casesynctext += 'p4 resolve -am\n';
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
      //dcelabsynctext += 'rm -rf ~/.jfrog/\n';
      //dcelabsynctext += '/home/benpeng/nbifweb_client/software/tools/rtlogin\n';
      //dcelabsynctext += 'rt_login\n';
      dcelabsynctext += 'p4_mkwa -codeline '+result1[0].codeline+' -branch_name '+result1[0].branch_name+' -cl '+result1[0].changelist+'\n';
      //dcelabsynctext += 'p4 unshelve -s '+result1[0].shelve+'\n';
      //dcelabsynctext += 'p4 resolve -am\n';
      //dcelabsynctext += 'bootenv -v '+variants[v]+'\n';
      //dcelabsynctext += 'p4w sync_all\n';
      //dcelabsynctext += 'p4 resolve -am\n';
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
      //buildtext += 'rm -rf ~/.jfrog/\n';
      //buildtext += '/home/benpeng/nbifweb_client/software/tools/rtlogin\n';
      //buildtext += 'rt_login\n';
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
      //rundcelabtext += 'rm -rf ~/.jfrog/\n';
      //rundcelabtext += '/home/benpeng/nbifweb_client/software/tools/rtlogin\n';
      //rundcelabtext += 'rt_login\n';
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
      let syncregxpass  = /All syncs OK/;
      //cases part
      console.log(variants[v] +' sync begin');
      let starttimecasesync = new moment();
      child_process.exec('bsub -P bif-shub2 -q regr_high -Is -J nbif_S_sy -R "rusage[mem=2000] select[type==RHEL7_64]" '+treeRoot+'.sync.script > '+treeRoot+'.sync.log',{
        maxBuffer : 1024*1024*1024
      },function(err2,stdout2,stderr2){
        let endtimecasesync = new moment();
        console.log(variants[v] +' sync cost '+moment.duration(endtimecasesync.diff(starttimecasesync)).as('minutes')+' minutes');
        console.log(variants[v] +' sync done');
        if(err2){
          console.log(err2);
        }
        console.log(variants[v] +' build begin');
        child_process.exec('bsub -P bif-shub2 -q regr_high -Is -J nbif_S_bd -R "rusage[mem=5000] select[type==RHEL7_64]" '+treeRoot+'.build.script',{
          maxBuffer : 1024*1024*1024
        },function(err3,stdout3,stderr3){
          let endtimecasebuild  = new moment();
          console.log(variants[v] +' build cost '+moment.duration(endtimecasebuild.diff(endtimecasesync)).as('minutes')+' minutes');
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
                  stat[variants[v]][JSON.parse(result1[0].testlist)[t]]='';
                  let runcasetext='';
                  runcasetext += '#!/tool/pandora64/bin/tcsh\n';
                  runcasetext += 'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
                  runcasetext += 'cd '+treeRoot+'\n';
                  //runcasetext += 'rm -rf ~/.jfrog/\n';
                  //runcasetext += '/home/benpeng/nbifweb_client/software/tools/rtlogin\n';
                  //runcasetext += 'rt_login\n';
                  runcasetext += 'bootenv -v '+variants[v]+'\n';
                  runcasetext += 'dj -l '+treeRoot+'/'+JSON.parse(result1[0].testlist)[t]+'.log -DUVM_VERBOSITY=UVM_LOW -m4 -DUSE_VRQ -DCGM -DSEED=12345678 run_test -s nbiftdl '+JSON.parse(result1[0].testlist)[t]+'_nbif_all_rtl -a run=only\n';
                  fs.writeFileSync(treeRoot+'.'+JSON.parse(result1[0].testlist)[t]+'.run.script',runcasetext,{
                    encoding  : 'utf8',
                    mode      : '0700',
                    flag      : 'w'
                  });
                  console.log(variants[v]+' '+JSON.parse(result1[0].testlist)[t]+' run begin');
                  child_process.exec('bsub -P bif-shub2 -q regr_high -Is -J nbif_S_rn -R "rusage[mem=5000] select[type==RHEL7_64]" '+treeRoot+'.'+JSON.parse(result1[0].testlist)[t]+'.run.script',{
                    maxBuffer : 1024*1024*1024
                  },function(err4,stdout4,stderr4){
                    let endtimecaserun  = new moment();
                    console.log(variants[v] +' run cost '+moment.duration(endtimecaserun.diff(endtimecasebuild)).as('minutes')+' minutes');
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
                          stat[variants[v]][JSON.parse(result1[0].testlist)[t]]='RUNFAIL';
                          console.log('stat :'+stat);
                          console.log('stat :'+JSON.stringify(stat));
                          fs.writeFileSync(workspace+'/result.'+variants[v]+'.'+JSON.parse(result1[0].testlist)[t]+'.RUNFAIL','',{
                            encoding  : 'utf8',
                            mode      : '0600',
                            flag      : 'w'
                          });
                          break;
                        }
                        if(djregxpass.test(lines[l])){
                          console.log(variants[v]+' '+JSON.parse(result1[0].testlist)[t]+' run pass');
                          stat[variants[v]][JSON.parse(result1[0].testlist)[t]]='RUNPASS';
                          console.log('stat :'+stat);
                          console.log('stat :'+JSON.stringify(stat));
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
                        stat[variants[v]][JSON.parse(result1[0].testlist)[t]]='RUNUNKNOWN';
                        console.log('stat :'+stat);
                        console.log('stat :'+JSON.stringify(stat));
                        fs.writeFileSync(workspace+'/result.'+variants[v]+'.'+JSON.parse(result1[0].testlist)[t]+'.RUNUNKNOWN','',{
                          encoding  : 'utf8',
                          mode      : '0600',
                          flag      : 'w'
                        });
                      }
                      checkifalldone(workspace,numberofresult,result1[0],stat);
                    }
                    else{
                      console.log(variants[v]+' '+JSON.parse(result1[0].testlist)[t]+' run unknown');
                      stat[variants[v]][JSON.parse(result1[0].testlist)[t]]='RUNUNKNOWN';
                      console.log('stat :'+stat);
                      console.log('stat :'+JSON.stringify(stat));
                      fs.writeFileSync(workspace+'/result.'+variants[v]+'.'+JSON.parse(result1[0].testlist)[t]+'.RUNUNKNOWN','',{
                        encoding  : 'utf8',
                        mode      : '0600',
                        flag      : 'w'
                      });
                      checkifalldone(workspace,numberofresult,result1[0],stat);
                    }
                  });
                }
                break;
              }
              if(djregxfail.test(lines[l])){
                console.log(variants[v]+' build fail');
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
                  stat[variants[v]][JSON.parse(result1[0].testlist)[t]]='BUILDFAIL';
                  console.log('stat :'+stat);
                  console.log('stat :'+JSON.stringify(stat));
                  fs.writeFileSync(workspace+'/result.'+variants[v]+'.'+JSON.parse(result1[0].testlist)[t]+'.BUILDFAIL','',{
                    encoding  : 'utf8',
                    mode      : '0600',
                    flag      : 'w'
                  });
                }
                checkifalldone(workspace,numberofresult,result1[0],stat);
                break;
              }
            }
          }
        });
      });
      //dcelab part
      let starttimedcsync = new moment();
      console.log(variants[v]+' dcelab sync begin');
      child_process.exec('bsub -P bif-shub2 -q regr_high -Is -J nbif_S_dcsy -R "rusage[mem=2000] select[type==RHEL7_64]" '+dcelabRoot+'.sync.script  > '+dcelabRoot+'.sync.log',{
        maxBuffer : 1024*1024*1024
      },function(err2,stdout2,stderr2){
        if(err2){
          console.log(err2);
        }
        let endtimedcsync = new moment();
        console.log(variants[v]+' dcelab sync cost '+moment.duration(endtimedcsync.diff(starttimedcsync)).as('minutes')+' minutes');
        console.log(variants[v]+' dcelab sync done');
        child_process.exec('bsub -P bif-shub2 -q regr_high -Is -J nbif_S_dcrn -R "rusage[mem=40000] select[type==RHEL7_64]" '+dcelabRoot+'.run.script',{
          maxBuffer : 1024*1024*1024
        },function(err3,stdout3,stderr3){
          let endtimedcrun  = new moment();
          console.log(variants[v]+' dcelab run cost '+moment.duration(endtimedcrun.diff(endtimedcsync)).as('minutes')+' minutes');
          console.log(variants[v]+' dcelab run done');
          if(err3){
            console.log(err3);
          }
          if(!fs.existsSync(dcelabRoot+"/dcelab.log")){
            console.log(variants[v]+' dcelab UNKNOWN');
            stat[variants[v]]['dcelab']='RUNUNKNOWN';
            console.log('stat :'+stat);
            console.log('stat :'+JSON.stringify(stat));
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
                stat[variants[v]]['dcelab']='RUNPASS';
                console.log('stat :'+stat);
                console.log('stat :'+JSON.stringify(stat));
                fs.writeFileSync(workspace+'/result.'+variants[v]+'.dcelab.RUNPASS','',{
                  encoding  : 'utf8',
                  mode      : '0600',
                  flag      : 'w'
                });
                break;
              }
              if(djregxfail.test(lines[l])){
                console.log(variants[v]+' dcelab FAIL');
                stat[variants[v]]['dcelab']='RUNFAIL';
                console.log('stat :'+stat);
                console.log('stat :'+JSON.stringify(stat));
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
              stat[variants[v]]['dcelab']='RUNUNKNOWN';
              console.log('stat :'+stat);
              console.log('stat :'+JSON.stringify(stat));
              fs.writeFileSync(workspace+'/result.'+variants[v]+'.dcelab.RUNUNKNOWN','',{
                encoding  : 'utf8',
                mode      : '0600',
                flag      : 'w'
              });
            }
            checkifalldone(workspace,numberofresult,result1[0],stat);
          }
        });
      });
    }
  });
  //cron_check.stop();
},null,true,'Asia/Chongqing');
