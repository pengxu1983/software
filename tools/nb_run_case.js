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
let runtimeout  = 6*60;

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
  console.log('hostname :'+$1);
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
  console.log('site :'+site);
});
let nb_run_case_cmd='nb_run_case_cmd.'+index;
currentUser = child_process.execSync('whoami',{
  encoding  : 'utf8'
}).split('\n');
currentUser = currentUser[0];
console.log(currentUser);
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
  console.log(treeRoot);
});
let testlist  = [];
let cmd_S = {};
let variants  = [];
let data  = fs.readFileSync(treeRoot+'/multiplerunprofile.xml');
parser.parseString(data,function(err,result){
  //console.dir(result.TOP.variant[0].test[0]);
  for(let v=0;v<result.TOP.variant.length;v++){
    variants.push(result.TOP.variant[v].$.name);
    cmd_S[result.TOP.variant[v].$.name]={};
    //tests
    if(result.TOP.variant[v].hasOwnProperty('test')){
      cmd_S[result.TOP.variant[v].$.name]['test']={};
      for(let t=0;t<result.TOP.variant[v].test.length;t++){
        console.log(result.TOP.variant[v].test[t].name);
        cmd_S[result.TOP.variant[v].$.name]['test'][result.TOP.variant[v].test[t].name]={};
        cmd_S[result.TOP.variant[v].$.name]['test'][result.TOP.variant[v].test[t].name]['config']=result.TOP.variant[v].test[t].config;
        cmd_S[result.TOP.variant[v].$.name]['test'][result.TOP.variant[v].test[t].name]['UVM_VERBOSITY']=result.TOP.variant[v].test[t].UVM_VERBOSITY;
        cmd_S[result.TOP.variant[v].$.name]['test'][result.TOP.variant[v].test[t].name]['suite']=result.TOP.variant[v].test[t].suite;
        cmd_S[result.TOP.variant[v].$.name]['test'][result.TOP.variant[v].test[t].name]['wave']=result.TOP.variant[v].test[t].wave;
        cmd_S[result.TOP.variant[v].$.name]['test'][result.TOP.variant[v].test[t].name]['seed']=result.TOP.variant[v].test[t].seed;
      }
    }
    //tasks
  }
});
fs.unlinkSync('/home/'+currentUser+'/.nb_cmd_tmp/'+nb_run_case_cmd);
console.dir(cmd_S['nbif_et_1']['test']['demo_test_0']);
if(site ==  'atl'){
  for(let variantname in cmd_S){
    //test
    if(cmd_S[variantname].hasOwnProperty('test')){
      for(let testname  in cmd_S[variantname]['test']){
        let text  = '';
        text  +=  '#!/tool/pandora64/bin/tcsh\n';
        text  +=  'source /proj/verif_release_ro/cbwa_initscript/current/cbwa_init.csh\n';
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
        console.log('CMD '+text);
        fs.writeFileSync(treeRoot+'/nb__.'+variantname+'.test.'+testname+'.script',text,{
          encoding  : 'utf8',
          mode      : 0700,
          flag      : 'w'
        });
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
}
