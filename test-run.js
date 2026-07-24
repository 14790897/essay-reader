const WebSocket = require('ws');
const MsgType = { FullClientRequest: 1, AudioOnlyClient: 2, FullServerResponse: 9, AudioOnlyServer: 11, FrontEndResultServer: 12, Error: 15 };
const Fl = { NoSeq: 0, PositiveSeq: 1, LastNoSeq: 2, NegativeSeq: 3, WithEvent: 4 };
const Ev = { StartConnection: 1, FinishConnection: 2, StartSession: 100, CancelSession: 101, FinishSession: 102, TaskRequest: 200, ConnectionStarted: 50, ConnectionFailed: 51, ConnectionFinished: 52, SessionStarted: 150, SessionCanceled: 151, SessionFinished: 152, SessionFailed: 153, TTSSentenceStart: 350, TTSSentenceEnd: 351, TTSResponse: 352, TTSSubtitle: 364 };
const EN = {};
for(const [k,v] of Object.entries(Ev)) EN[v]=k;

function hdr(mt,fl,ser=1,comp=0){const b=Buffer.alloc(4);b[0]=0x11;b[1]=(mt<<4)|(fl&0xF);b[2]=(ser<<4)|(comp&0xF);b[3]=0;return b;}
function i32(v){const b=Buffer.alloc(4);b.writeInt32BE(v);return b;}
function u32(v){const b=Buffer.alloc(4);b.writeUInt32BE(v);return b;}

function build(mt,fl,e,sid,pl){
  const parts=[hdr(mt,fl),i32(e)];
  if(sid&&![1,2,50,51,52].includes(e)){
    const s=Buffer.from(sid,'utf-8'); parts.push(u32(s.length),s);
  }
  const p=Buffer.from(pl||'{}','utf-8'); parts.push(u32(p.length),p);
  return Buffer.concat(parts);
}

const SC=build(1,4,1,null,'{}');
const FC=build(1,4,2,null,'{}');

function parse(buf){
  let o=0;
  const vhs=buf[o++]; const mt=buf[o]>>4; const fl=buf[o++]&0xF; o+=1; o=(vhs&0xF)*4;
  const m={mt,fl,ev:0,sid:'',cid:'',seq:0,ec:0,pl:null};
  if([1,2,9,11,12].includes(mt)&&(fl===1||fl===3)){m.seq=buf.readInt32BE(o);o+=4}
  else if(mt===15){m.ec=buf.readUInt32BE(o);o+=4}
  if(fl===4){
    m.ev=buf.readInt32BE(o);o+=4;
    if(![1,2,50,51,52].includes(m.ev)){const sl=buf.readUInt32BE(o);o+=4;if(sl){m.sid=buf.slice(o,o+sl).toString('utf-8');o+=sl;}}
    if([50,51,52].includes(m.ev)){const cl=buf.readUInt32BE(o);o+=4;if(cl){m.cid=buf.slice(o,o+cl).toString('utf-8');o+=cl;}}
  }
  const pl=buf.readUInt32BE(o);o+=4; if(pl){m.pl=buf.slice(o,o+pl);}
  return m;
}

async function main(){
  const AK='0348cc4e-6e60-4a0f-b1ce-142d00b98350';
  const SP='zh_female_gaolengyujie_uranus_bigtts';
  const TXT='你好，欢迎使用豆包语音合成服务。';
  const SID='bf5b5771-31cd-4f7a-b30c-f4ddcbf2f9da';
  console.log('Connecting...');
  const ws=new WebSocket('wss://openspeech.bytedance.com/api/v3/tts/bidirection',{headers:{'X-Api-Key':AK,'X-Api-Resource-Id':'seed-tts-2.0'}});
  const audio=[];
  ws.on('open',()=>{console.log('>> StartConnection');ws.send(SC);});
  ws.on('message',(data,isBin)=>{
    let b;
    if(Buffer.isBuffer(data))b=data;
    else if(typeof data==='string'){b=Buffer.alloc(data.length);for(let i=0;i<data.length;i++){b[i]=data.charCodeAt(i)&0xFF;}}
    else return;
    const m=parse(b);
    const en=EN[m.ev]||('Evt'+m.ev);
    if(m.mt===9)console.log('<< '+en+' pl='+(m.pl||'').toString().substring(0,150));
    else if(m.mt===11){console.log('<< '+en+' audio='+(m.pl||Buffer.of()).length+'B');if(m.pl)audio.push(m.pl);}
    else if(m.mt===15)console.log('<< ERR ec='+m.ec+' pl='+(m.pl||'').toString());
    else console.log('<< '+en+' mt='+m.mt);

    if(m.ev===50){
      // Match Python exactly: single object, no text in StartSession
      const r=JSON.stringify({event:100,req_params:{speaker:SP,audio_params:{format:'mp3',sample_rate:24000}}});
      console.log('>> StartSession payload_len='+Buffer.from(r,'utf-8').length);
      ws.send(build(1,4,100,SID,r));
    }else if(m.ev===150){
      const r=JSON.stringify({event:200,req_params:{speaker:SP,text:TXT,audio_params:{format:'mp3',sample_rate:24000}}});
      console.log('>> TaskRequest+FinishSession');
      ws.send(build(1,4,200,SID,r));ws.send(build(1,4,102,SID,'{}'));
    }else if(m.ev===152){
      console.log('>> FinishConnection');ws.send(FC);
    }else if(m.ev===52){
      const ta=Buffer.concat(audio);
      require('fs').writeFileSync('test-output.mp3',ta);
      console.log('SAVED '+ta.length+' bytes!');
      ws.close();
    }else if(m.ev===51||m.ev===153){
      console.error('FAILED',en,(m.pl||'').toString());ws.close();
    }
  });
  ws.on('error',e=>console.error('WSerr:',e.message));
  ws.on('close',c=>console.log('Closed',c));
  setTimeout(()=>{if(ws.readyState===1)ws.close();},20000);
}
main().catch(console.error);
