#include "rime_api.h"
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/stat.h>
static RimeApi* api;
static RimeSessionId session;
static void writefile(const char* dir,const char* name,const char* text) { char path[4096],temp[4096];snprintf(path,sizeof(path),"%s/%s",dir,name);snprintf(temp,sizeof(temp),"%s/%s.tmp",dir,name);FILE* f=fopen(temp,"w");if(!f)exit(2);fputs(text,f);fclose(f);rename(temp,path); }
static void check(int ok,const char* message) { if(!ok){fprintf(stderr,"FAIL %s\n",message);exit(1);} printf("PASS %s\n",message); }
static void type(const char* text) { api->clear_composition(session); while(*text) api->process_key(session,*text++,0); }
static int suffix(const char* value) { char buf[2048]={0}; api->get_property(session,"memeboard_suffix",buf,sizeof(buf)); if(strcmp(buf,value)){fprintf(stderr,"actual suffix: %s\n",buf);return 0;}return 1; }
int main(int argc,char**argv) {
 check(argc==2,"isolated test directory provided");
 void* core=dlopen("/Library/Input Methods/Squirrel.app/Contents/Frameworks/librime.1.dylib",RTLD_NOW|RTLD_GLOBAL); check(core!=NULL,"installed librime loaded");
 void* lua=dlopen("/Library/Input Methods/Squirrel.app/Contents/Frameworks/rime-plugins/librime-lua.dylib",RTLD_NOW|RTLD_GLOBAL); check(lua!=NULL,"installed librime-lua loaded");
 api=((RimeApi*(*)(void))dlsym(core,"rime_get_api"))();
 RIME_STRUCT(RimeTraits,traits); traits.shared_data_dir=argv[1];traits.user_data_dir=argv[1];traits.app_name="rime.memeboard-spike";traits.distribution_code_name="Squirrel";traits.min_log_level=2;traits.log_dir=argv[1];
 const char* modules[]={"core","dict","gears","lua","deployer",NULL};traits.modules=modules;
 api->setup(&traits);api->initialize(&traits);api->deployer_initialize(&traits);
 char schema[4096];snprintf(schema,sizeof(schema),"%s/memeboard_spike.schema.yaml",argv[1]);check(api->deploy_schema(schema),"isolated schema deploys");
 session=api->create_session();check(session!=0,"real Rime session created");check(api->select_schema(session,"memeboard_spike"),"test schema selected");
 api->set_option(session,"super_tips",1);api->set_option(session,"ascii_mode",0);
 RimeConfig config;char value[512]={0};check(api->schema_open("memeboard_spike",&config),"deployed schema readable");
 api->config_get_string(&config,"engine/processors/@0",value,sizeof(value));check(strcmp(value,"lua_processor@*meme_tips*before")==0,"before patch ordered correctly");
 api->config_get_string(&config,"engine/processors/@2",value,sizeof(value));check(strcmp(value,"lua_processor@*meme_tips*after")==0,"after patch ordered correctly");api->config_close(&config);
 type("mmwy");check(suffix("〔🖼️ 猫猫无语 · ,〕"),"raw trigger shows comma image tip");
 type("both");check(suffix(" 〔🖼️ 猫猫无语 · ;〕"),"upstream and image tips coexist in real engine");
 api->process_key(session,',',0);RIME_STRUCT(RimeCommit,commit);check(api->get_commit(session,&commit),"official comma commits");check(strcmp(commit.text,"😂")==0,"official comma retains original text");api->free_commit(&commit);
 const char* tip_inputs[]={"fanyi","huaxue","fuhao"};const char* tip_outputs[]={"hello","H₂O","→"};
 for(int i=0;i<3;i++){type(tip_inputs[i]);api->process_key(session,',',0);RIME_STRUCT(RimeCommit,tip);check(api->get_commit(session,&tip),"upstream text tip commits");check(strcmp(tip.text,tip_outputs[i])==0,"translation, chemistry or symbol behavior preserved");api->free_commit(&tip);}
 type("mmwy");api->change_page(session,0);check(suffix(""),"later page ignores raw trigger in real engine");

 type("maom");api->process_key(session,0xff54,0);check(suffix(""),"Down removes image prompt immediately");
 api->process_key(session,0xff52,0);check(suffix("〔🖼️ 猫猫无语 · ,〕"),"Up restores candidate image prompt");
 api->set_option(session,"super_tips",0);check(suffix(""),"option toggle removes image prompt");api->set_option(session,"super_tips",1);
 type("mmwy");check(api->process_key(session,',',0),"image comma accepted");check(strcmp(api->get_input(session),"")==0,"composition cleared for image paste");
 char marker[4096];snprintf(marker,sizeof(marker),"%s/helper-called",argv[1]);for(int i=0;i<50&&access(marker,F_OK);i++)usleep(10000);check(access(marker,F_OK)==0,"Rime Lua launches detached helper successfully");

 usleep(1100000);
 writefile(argv[1],"memeboard/index.tsv","T\tnewtrigger\t7d31c15e-1111-4111-8111-000000000001\t新图片\nN\t新图片\t7d31c15e-1111-4111-8111-000000000001\t新图片\n");
 writefile(argv[1],"memeboard/version","2\n");
 type("newtrigger");check(suffix("〔🖼️ 新图片 · ,〕"),"new trigger hot-reloads without redeploy");
 usleep(1100000);writefile(argv[1],"memeboard/index.tsv","invalid\n");writefile(argv[1],"memeboard/version","3\n");
 type("newtrigger");check(suffix("〔🖼️ 新图片 · ,〕"),"invalid real-engine reload retains old cache");
 usleep(1100000);writefile(argv[1],"memeboard/index.tsv","");writefile(argv[1],"memeboard/version","4\n");
 type("newtrigger");check(suffix(""),"deleted image disappears without redeploy");
 api->destroy_session(session);api->finalize();return 0;
}
