#!/home/benpeng/nbifweb_client/software/node/bin/node
let fs              = require('fs');
let xml2js          = require('xml2js');
let moment          = require('moment');
let process         = require('process');
let child_process   = require('child_process');
let querystring     = require('querystring');
let http            = require('http');
let parser          = new xml2js.Parser();
let loginit         = function(){
  return '[LOG]['+moment().format('YYYY-MM-DD HH:mm:ss')+'] ';
};
let djregxfail      = /dj exited with errors/;
let djregxpass      = /dj exited successfully/;
let getemail        = function(username){
  let email;
  let lines = fs.readFileSync('/home/benpeng/p4users','utf8').split('\n');
  lines.pop();
  let regx  = /^(\w+) <(\S+)>.*accessed/;
  for(let l=0;l<lines.length;l++){
    if(regx.test(lines[l])){
      lines[l].replace(regx,function(rs,$1,$2){
        if($1==username){
          email = $2;
        }
      })
    }
  }
  return email;
}
let runtimeout  = 12*60;

let treeRoot;
let currentDir;
let currentUser;
let index=0;
let site;
let hostname = child_process.execSync('hostname',{
    encoding  : 'utf8'
});
let regx01  = /^(\S+)/;
hostname.replace(regx01,function(rs,$1){
  console.log(loginit()+'hostname :'+$1);
  hostname  = $1;
  let regx02  = /srdc/;
  let regx03  = /atl/;
  if(regx02.test(hostname)){
    site  = 'srdc';
    //port  = 7010;
  }
  if(regx03.test(hostname)){
    site  = 'atl';
    //port  = 7010;
  }
  console.log(loginit()+'site :'+site);
});
let nb_run_case_cmd='nb_run_case_cmd.'+index;
currentUser = child_process.execSync('whoami',{
  encoding  : 'utf8'
}).split('\n');
currentUser = currentUser[0];
console.log(loginit()+'currentUser : '+currentUser);
currentDir  = process.cwd();
child_process.execSync('mkdir -p /home/'+currentUser+'/.nb_cmd_tmp/');
while(fs.existsSync('/home/'+currentUser+'/.nb_cmd_tmp/'+nb_run_case_cmd)){
  index++;
  nb_run_case_cmd = 'nb_run_case_cmd.'+index;
}
fs.writeFileSync('/home/'+currentUser+'/.nb_cmd_tmp/'+nb_run_case_cmd,'',{
  encoding  : 'utf8'
});


let text  = '';
text  +=  '#!/tool/pandora64/bin/tcsh\n';
text  +=  'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
text  +=  'bootenv\n';
text  +=  'echo "treeRoot:::$STEM"\n';
fs.writeFileSync('/home/'+currentUser+'/.nb_cmd_tmp/'+nb_run_case_cmd,text,{
  encoding  : 'utf8',
  //mode      : '0777',
  flag      : 'w'
});
child_process.execSync('chmod +x '+'/home/'+currentUser+'/.nb_cmd_tmp/'+nb_run_case_cmd);
let R = child_process.execSync('/home/'+currentUser+'/.nb_cmd_tmp/'+nb_run_case_cmd,{
  encoding  : 'utf8',
});
let regx04  = /treeRoot:::(\S+)/;
R.replace(regx04,function(rs,$1){
  treeRoot  = $1;
  console.log(loginit()+'treeRoot : '+treeRoot);
});
let testlist  = [];
let cmd_S = {};
let variants  = [];
let data  = fs.readFileSync(treeRoot+'/multiplerunprofile.xml');
parser.parseString(data,function(err,result){
  //console.dir(result.TOP.variant[0].test[0]);
  for(let v=0;v<result.TOP.variant.length;v++){
    let variantname = result.TOP.variant[v].$.name;
    cmd_S[variantname]={};
    //tests
    if(result.TOP.variant[v].hasOwnProperty('test')){
      cmd_S[variantname]['test']={};
      let testlist  = result.TOP.variant[v].test;
      for(let t=0;t<testlist.length;t++){
        cmd_S[variantname]['test'][testlist[t].name]={};
        cmd_S[variantname]['test'][testlist[t].name]['config']
          =result.TOP.variant[v].test[t].config[0];
        cmd_S[variantname]['test'][testlist[t].name]['UVM_VERBOSITY']
          =result.TOP.variant[v].test[t].UVM_VERBOSITY[0];
        cmd_S[variantname]['test'][testlist[t].name]['suite']
          =result.TOP.variant[v].test[t].suite[0];
        cmd_S[variantname]['test'][testlist[t].name]['wave']
          =result.TOP.variant[v].test[t].wave[0];
        cmd_S[variantname]['test'][testlist[t].name]['seed']
          =result.TOP.variant[v].test[t].seed[0];
        cmd_S[variantname]['test'][testlist[t].name]['run']
          =result.TOP.variant[v].test[t].run[0];
      }
    }
    //tasks
    if(result.TOP.variant[v].hasOwnProperty('task')){
      cmd_S[variantname]['task']={};
      //pa
      if(result.TOP.variant[v].task[0].hasOwnProperty('pa')){
        cmd_S[variantname]['task']['pa']={};
        cmd_S[variantname]['task']['pa']['run']
          =result.TOP.variant[v].task[0].pa[0].run[0];
        cmd_S[variantname]['task']['pa']['test']={};
        if(result.TOP.variant[v].task[0].pa[0].hasOwnProperty('test')){
          for(let t=0;t<result.TOP.variant[v].task[0].pa[0].test.length;t++){
            let testname  = result.TOP.variant[v].task[0].pa[0].test[t].name[0];
            cmd_S[variantname]['task']['pa']['test'][testname]  = {};
            cmd_S[variantname]['task']['pa']['test'][testname]['run']
              = result.TOP.variant[v].task[0].pa[0].test[t].run[0];
            console.log(cmd_S[variantname]['task']['pa']['test'][testname]['run']);
            cmd_S[variantname]['task']['pa']['test'][testname]['config']
              = result.TOP.variant[v].task[0].pa[0].test[t].config[0];
            cmd_S[variantname]['task']['pa']['test'][testname]['suite']
              = result.TOP.variant[v].task[0].pa[0].test[t].suite[0];
            cmd_S[variantname]['task']['pa']['test'][testname]['UVM_VERBOSITY']
              = result.TOP.variant[v].task[0].pa[0].test[t].UVM_VERBOSITY[0];
          }
        }
      }
    }
  }
});
fs.unlinkSync('/home/'+currentUser+'/.nb_cmd_tmp/'+nb_run_case_cmd);
//console.dir(cmd_S['nbif_et_1']['test']['demo_test_0']);
if(site ==  'atl'){
  for(let variantname in cmd_S){
    //test
    if(cmd_S[variantname].hasOwnProperty('test')){
      for(let testname  in cmd_S[variantname]['test']){
        if(cmd_S[variantname]['test'][testname]['run']  ==  'yes'){
          let text  = '';
          text  +=  '#!/tool/pandora64/bin/tcsh\n';
          text  +=  'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
          text  +=  'cd '+treeRoot+'\n';
          text  +=  'bootenv -v '+variantname+' -out_anchor '+treeRoot+'/out.'+variantname+'.test.'+testname+'\n';
          text  +=  'dj -q -l  '+treeRoot+'/nb__.'+variantname+'.test.'+testname+'.djlog';
          if(cmd_S[variantname]['test'][testname].hasOwnProperty('wave')){
            if(cmd_S[variantname]['test'][testname]['wave'] ==  'yes'){
              text  +=  ' -DDEBUG ';
            }
          }
          if(cmd_S[variantname]['test'][testname].hasOwnProperty('UVM_VERBOSITY')){
            text  +=  ' -DUVM_VERBOSITY='+cmd_S[variantname]['test'][testname]['UVM_VERBOSITY']+' ';
          }
          else{
            text  +=  ' -DUVM_VERBOSITY=UVM_LOW ';
          }
          text  +=  '-m4 -DUSE_VRQ -DCGM ';
          if(cmd_S[variantname]['test'][testname].hasOwnProperty('seed')){
            text  +=  ' -DSEED='+cmd_S[variantname]['test'][testname]['seed']+' ';
          }
          else{
            text  +=  ' -DSEED=12345678 ';
          }
          text += ' run_test -s '+cmd_S[variantname]['test'][testname]['suite']+' '+testname+'_'+cmd_S[variantname]['test'][testname]['config']+' \n';
          //console.log('CMD '+text);
          fs.writeFileSync(treeRoot+'/nb__.'+variantname+'.test.'+testname+'.script',text,{
            encoding  : 'utf8',
            mode      : 0700,
            flag      : 'w'
          });
          fs.unlinkSync(treeRoot+'/nb__.'+variantname+'.test.'+testname+'.djlog');
          if(fs.existsSync(treeRoot+'/result.'+variantname+'.test.'+testname+'.PASS')){
            fs.unlinkSync(treeRoot+'/result.'+variantname+'.test.'+testname+'.PASS');
          }
          if(fs.existsSync(treeRoot+'/result.'+variantname+'.test.'+testname+'.FAIL')){
            fs.unlinkSync(treeRoot+'/result.'+variantname+'.test.'+testname+'.FAIL');
          }
          child_process.exec('bsub -P GIONB-SRDC -W '+runtimeout+' -q regr_high -Is -J nbif_R_rn -R "rusage[mem=10000] select[type==RHEL7_64]" '+treeRoot+'/nb__.'+variantname+'.test.'+testname+'.script',function(err,stdout,stderr){
            if(fs.existsSync(treeRoot+'/nb__.'+variantname+'.test.'+testname+'.djlog')){
              let lines = fs.readFileSync(treeRoot+'/nb__.'+variantname+'.test.'+testname+'.djlog','utf8').split('\n');
              lines.pop();
              for(let l=0;l<lines.length;l++){
                if(djregxpass.test(lines[l])){
                  fs.writeFileSync(treeRoot+'/result.'+variantname+'.test.'+testname+'.PASS','',{
                    encoding  : 'utf8',
                    mode      : 0600,
                    flag      : 'w'
                  });
                  break;
                }
                if(djregxfail.test(lines[l])){
                  fs.writeFileSync(treeRoot+'/result.'+variantname+'.test.'+testname+'.FAIL','',{
                    encoding  : 'utf8',
                    mode      : 0600,
                    flag      : 'w'
                  });
                  break;
                }
              }
            }
          });
        }
      }
    }
    //task
    if(cmd_S[variantname].hasOwnProperty('task')){
      console.dir(cmd_S[variantname]['task']);
      ////pa
      if(cmd_S[variantname]['task'].hasOwnProperty('pa')){
        if(cmd_S[variantname]['task']['pa']['run']  ==  'yes'){
          //dcelab
          let dcelabtext  = '';
          dcelabtext  +=  '#!/tool/pandora64/bin/tcsh\n';
          dcelabtext  +=  'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
          dcelabtext  +=  'cd '+treeRoot+'\n';
          dcelabtext  +=  'bootenv -v '+variantname+' -out_anchor '+treeRoot+'/out.'+variantname+'.task.pa.dcelab\n';
          if(variantname  ==  "nbif_al_gpu"){
            dcelabtext  +=  'dj -q -v -l '+treeRoot+'/nb__.'+variantname+'.task.pa.dcelab.djlog -e \'releaseflow::dropflow(:rtl_drop).build(:rhea_drop,:rhea_dc)\' -DPUBLISH_BLKS=nbif_shub_wrap_algfx\n';
          }
          if(variantname  ==  "nbif_draco_gpu"){
            dcelabtext  +=  'dj -q -v -l '+treeRoot+'/nb__.'+variantname+'.task.pa.dcelab.djlog -e \'releaseflow::dropflow(:rtl_drop).build(:rhea_drop,:rhea_dc)\' -DPUBLISH_BLKS=nbif_shub_wrap_dcgfx\n';
          }
          if(variantname  ==  "nbif_nv10_gpu"){
            dcelabtext  +=  'dj -q -v -l '+treeRoot+'/nb__.'+variantname+'.task.pa.dcelab.djlog -e \'releaseflow::dropflow(:rtl_drop).build(:rhea_drop,:rhea_dc)\' -DPUBLISH_BLKS=nbif_shub_wrap_gfx\n';
          }
          if(variantname  ==  "nbif_et_0"){
            dcelabtext  +=  'dj -q -v -l '+treeRoot+'/nb__.'+variantname+'.task.pa.dcelab.djlog -e \'releaseflow::dropflow(:rtl_drop).build(:rhea_drop,:rhea_dc)\' -DPUBLISH_BLKS=nbif_shub_wrap_et_0\n';
          }
          if(variantname  ==  "nbif_et_1"){
            dcelabtext  +=  'dj -q -v -l '+treeRoot+'/nb__.'+variantname+'.task.pa.dcelab.djlog -e \'releaseflow::dropflow(:rtl_drop).build(:rhea_drop,:rhea_dc)\' -DPUBLISH_BLKS=nbif_shub_wrap_et_1\n';
          }
          if(variantname  ==  "nbif_et_2"){
            dcelabtext  +=  'dj -q -v -l '+treeRoot+'/nb__.'+variantname+'.task.pa.dcelab.djlog -e \'releaseflow::dropflow(:rtl_drop).build(:rhea_drop,:rhea_dc)\' -DPUBLISH_BLKS=nbif_shub_wrap_et_2\n';
          }
          
          fs.writeFileSync(treeRoot+'/nb__.'+variantname+'.task.pa.dcelab.script',dcelabtext,{
            encoding  : 'utf8',
            mode      : 0700,
            flag      : 'w'
          });
          child_process.exec('bsub -P GIONB-SRDC -W '+runtimeout+' -q regr_high -Is -J nbif_R_rn -R "rusage[mem=40000] select[type==RHEL7_64]" '+treeRoot+'/nb__.'+variantname+'.task.pa.dcelab.script',function(err,stdout,stderr){
            if(fs.existsSync(treeRoot+'/nb__.'+variantname+'.task.pa.dcelab.djlog')){
              let lines = fs.readFileSync(treeRoot+'/nb__.'+variantname+'.task.pa.dcelab.djlog','utf8').split('\n');
              lines.pop();
              for(let l=0;l<lines.length;l++){
                if(djregxpass.test(lines[l])){
                  fs.writeFileSync(treeRoot+'/result.'+variantname+'.task.pa.dcelab.PASS','',{
                    encoding  : 'utf8',
                    mode      : 0600,
                    flag      : 'w'
                  });
                  break;
                }
                if(djregxfail.test(lines[l])){
                  fs.writeFileSync(treeRoot+'/result.'+variantname+'.task.pa.dcelab.FAIL','',{
                    encoding  : 'utf8',
                    mode      : 0600,
                    flag      : 'w'
                  });
                  break;
                }
              }
            }
            else{
              fs.writeFileSync(treeRoot+'/result.'+variantname+'.task.pa.dcelab.FAIL','',{
                encoding  : 'utf8',
                mode      : 0600,
                flag      : 'w'
              });
            }
            if(fs.existsSync(treeRoot+'/result.'+variantname+'.task.pa.dcelab.FAIL')){
              //sending notice //TODO
            }
            else if(fs.existsSync(treeRoot+'/result.'+variantname+'.task.pa.dcelab.PASS')){
              //test
              for(let testname  in cmd_S[variantname]['task']['pa']['test'] ){
                if(cmd_S[variantname]['task']['pa']['test'][testname]['run']  ==  'yes'){
                  let text  = '';
                  text  +=  '#!/tool/pandora64/bin/tcsh\n';
                  text  +=  'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
                  text  +=  'cd '+treeRoot+'\n';
                  text  +=  'bootenv -v '+variantname+' -out_anchor '+treeRoot+'/out.'+variantname+'.task.pa.test.'+testname+'\n';
                  text  +=  'dj -q -l  '+treeRoot+'/nb__.'+variantname+'.task.pa.test.'+testname+'.djlog';
                  text  +=  ' -DDEBUG ';
                  if(cmd_S[variantname]['task']['pa']['test'][testname].hasOwnProperty('UVM_VERBOSITY')){
                    text  +=  ' -DUVM_VERBOSITY='+cmd_S[variantname]['task']['pa']['test'][testname]['UVM_VERBOSITY']+' ';
                  }
                  else{
                    text  +=  ' -DUVM_VERBOSITY=UVM_LOW ';
                  }
                  text  +=  '-m4 -DUSE_VRQ -DCGM ';//TODO
                  text  +=  ' -DSEED=12345678 ';
                  text  +=  ' run_test -s '+cmd_S[variantname]['task']['pa']['test'][testname]['suite']+' '+testname+'_'+cmd_S[variantname]['task']['pa']['test'][testname]['config']+' \n';
                  //console.log('CMD '+text);
                  fs.writeFileSync(treeRoot+'/nb__.'+variantname+'.task.pa.test.'+testname+'.script',text,{
                    encoding  : 'utf8',
                    mode      : 0700,
                    flag      : 'w'
                  });
                  if(fs.existsSync(treeRoot+'/nb__.'+variantname+'.task.pa.test.'+testname+'.djlog')){
                    fs.unlinkSync(treeRoot+'/nb__.'+variantname+'.task.pa.test.'+testname+'.djlog');
                  }
                  if(fs.existsSync(treeRoot+'/result.'+variantname+'.task.pa.test.'+testname+'.PASS')){
                    fs.unlinkSync(treeRoot+'/result.'+variantname+'.task.pa.test.'+testname+'.PASS');
                  }
                  if(fs.existsSync(treeRoot+'/result.'+variantname+'.task.pa.test.'+testname+'.FAIL')){
                    fs.unlinkSync(treeRoot+'/result.'+variantname+'.task.pa.test.'+testname+'.FAIL');
                  }
                }
                child_process.exec(treeRoot+'/nb__.'+variantname+'.task.pa.test.'+testname+'.script',function(err,stdout,stderr){
                  if(fs.existsSync(treeRoot+'/nb__.'+variantname+'.task.pa.test.'+testname+'.djlog')){
                    let lines = fs.readFileSync(treeRoot+'/nb__.'+variantname+'.task.pa.test.'+testname+'.djlog','utf8').split('\n');
                    lines.pop();
                    for(let l=0;l<lines.length;l++){
                      if(djregxpass.test(lines[l])){
                        fs.writeFileSync(treeRoot+'/result.'+variantname+'.task.pa.test.'+testname+'.PASS','',{
                          encoding  : 'utf8',
                          mode      : 0600,
                          flag      : 'w'
                        });
                        break;
                      }
                      if(djregxfail.test(lines[l])){
                        fs.writeFileSync(treeRoot+'/result.'+variantname+'.task.pa.test.'+testname+'.FAIL','',{
                          encoding  : 'utf8',
                          mode      : 0600,
                          flag      : 'w'
                        });
                        break;
                      }
                    }
                  }
                  else{
                    fs.writeFileSync(treeRoot+'/result.'+variantname+'.task.pa.test.'+testname+'.FAIL','',{
                      encoding  : 'utf8',
                      mode      : 0600,
                      flag      : 'w'
                    });
                  }
                  if(fs.existsSync(treeRoot+'/result.'+variantname+'.task.pa.test.'+testname+'.FAIL')){
                    //send mail to notification
                  }
                  else if(fs.existsSync(treeRoot+'/result.'+variantname+'.task.pa.test.'+testname+'.PASS')){
                    //PA
                  }
                });
              }
            }
          });
          
          
        }
      }
      //dcc TODO
      //dcelab TODO
      //cdc TODO
      //lint TODO
    }

  }
}
