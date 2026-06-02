'use strict';

/**
 * SPECTRA v3.2 — Web Worker
 */

const RANKS    = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
const SUITS    = ['s','h','d','c'];
const RANK_VAL = {A:14,K:13,Q:12,J:11,T:10,9:9,8:8,7:7,6:6,5:5,4:4,3:3,2:2};
const HAND_NAMES = {
  1:'STRAIGHT FLUSH',2:'FOUR OF A KIND',3:'FULL HOUSE',
  4:'FLUSH',5:'STRAIGHT',6:'THREE OF A KIND',
  7:'TWO PAIR',8:'ONE PAIR',9:'HIGH CARD'
};

function rv(card){ return RANK_VAL[card[0]]; }
function sv(card){ return card[1]; }

function classify5(cards){
  const ranks = cards.map(rv).sort((a,b)=>b-a);
  const suits = cards.map(sv);
  const isFlush = suits.every(s=>s===suits[0]);
  const countMap={};
  ranks.forEach(r=>countMap[r]=(countMap[r]||0)+1);
  const counts=Object.values(countMap).sort((a,b)=>b-a);
  const uniq=[...new Set(ranks)].sort((a,b)=>b-a);

  let isStraight=false, straightHigh=0;
  if(uniq.length>=5){
    for(let i=0;i<=uniq.length-5;i++){
      if(uniq[i]-uniq[i+4]===4){isStraight=true;straightHigh=uniq[i];break;}
    }
    if(!isStraight&&uniq.includes(14)&&uniq.includes(2)&&uniq.includes(3)&&uniq.includes(4)&&uniq.includes(5)){
      isStraight=true;straightHigh=5;
    }
  }

  let type,tiebreak;
  if(isFlush&&isStraight){
    type=1;tiebreak=straightHigh;
  } else if(counts[0]===4){
    type=2;
    const quad=Number(Object.keys(countMap).find(k=>countMap[k]===4));
    const kick=Number(Object.keys(countMap).find(k=>countMap[k]!==4));
    tiebreak=quad*100+(kick||0);
  } else if(counts[0]===3&&counts[1]===2){
    type=3;
    const trip=Number(Object.keys(countMap).find(k=>countMap[k]===3));
    const pair=Number(Object.keys(countMap).find(k=>countMap[k]===2));
    tiebreak=trip*100+pair;
  } else if(isFlush){
    type=4;tiebreak=ranks[0]*1e8+ranks[1]*1e6+ranks[2]*1e4+ranks[3]*100+ranks[4];
  } else if(isStraight){
    type=5;tiebreak=straightHigh;
  } else if(counts[0]===3){
    type=6;
    const trip=Number(Object.keys(countMap).find(k=>countMap[k]===3));
    const kicks=uniq.filter(r=>r!==trip);
    tiebreak=trip*1e4+(kicks[0]||0)*100+(kicks[1]||0);
  } else if(counts[0]===2&&counts[1]===2){
    type=7;
    const pairs=Object.keys(countMap).filter(k=>countMap[k]===2).map(Number).sort((a,b)=>b-a);
    const kick=uniq.find(r=>!pairs.includes(r))||0;
    tiebreak=pairs[0]*1e4+pairs[1]*100+kick;
  } else if(counts[0]===2){
    type=8;
    const pair=Number(Object.keys(countMap).find(k=>countMap[k]===2));
    const kicks=uniq.filter(r=>r!==pair);
    tiebreak=pair*1e6+(kicks[0]||0)*1e4+(kicks[1]||0)*100+(kicks[2]||0);
  } else {
    type=9;tiebreak=ranks[0]*1e8+ranks[1]*1e6+ranks[2]*1e4+ranks[3]*100+ranks[4];
  }
  return{type,tiebreak};
}

// 正しい21通りの組み合わせ
function best5From7(c){
  let best=null;
  const n=c.length;
  for(let a=0;a<n-4;a++)
    for(let b=a+1;b<n-3;b++)
      for(let d=b+1;d<n-2;d++)
        for(let e=d+1;e<n-1;e++)
          for(let f=e+1;f<n;f++){
            const h=classify5([c[a],c[b],c[d],c[e],c[f]]);
            if(!best||h.type<best.type||(h.type===best.type&&h.tiebreak>best.tiebreak))best=h;
          }
  return best;
}

function typeToStrength(t){
  return({1:98,2:90,3:80,4:70,5:60,6:45,7:30,8:15,9:5})[t]||5;
}

function eval169(board,hero){
  const boardCards=(board||[]).filter(Boolean);
  const deadSet=new Set([...(hero||[]),...boardCards].filter(Boolean));
  const results=[];

  for(let i=0;i<13;i++){
    for(let j=0;j<13;j++){
      const r1=RANKS[i],r2=RANKS[j];
      let handStr,c1,c2,isSuited,isPair;

      if(i===j){
        handStr=r1+r2; isPair=true; isSuited=false;
        let found=false;
        outer1: for(let a=0;a<4;a++) for(let b=a+1;b<4;b++){
          const ca=r1+SUITS[a],cb=r2+SUITS[b];
          if(!deadSet.has(ca)&&!deadSet.has(cb)){c1=ca;c2=cb;found=true;break outer1;}
        }
        if(!found){results.push(null);continue;}
      } else if(i<j){
        handStr=r1+r2+'s'; isSuited=true; isPair=false;
        let found=false;
        for(let s=0;s<4&&!found;s++){
          const ca=r1+SUITS[s],cb=r2+SUITS[s];
          if(!deadSet.has(ca)&&!deadSet.has(cb)){c1=ca;c2=cb;found=true;}
        }
        if(!found){results.push(null);continue;}
      } else {
        handStr=r2+r1+'o'; isSuited=false; isPair=false;
        let found=false;
        outer2: for(let a=0;a<4;a++) for(let b=0;b<4;b++){
          if(a===b)continue;
          const ca=r2+SUITS[a],cb=r1+SUITS[b];
          if(!deadSet.has(ca)&&!deadSet.has(cb)){c1=ca;c2=cb;found=true;break outer2;}
        }
        if(!found){results.push(null);continue;}
      }

      const allCards=[c1,c2,...boardCards];
      let handResult;
      if(allCards.length>=5){
        handResult=best5From7(allCards);
      } else {
        const r=allCards.map(rv).sort((a,b)=>b-a);
        const cm={};r.forEach(x=>cm[x]=(cm[x]||0)+1);
        const cnts=Object.values(cm).sort((a,b)=>b-a);
        const type=cnts[0]===2?8:9;
        handResult={type,tiebreak:r[0]*100+(r[1]||0)};
      }

      results.push({
        hand:handStr,
        equity:typeToStrength(handResult.type),
        pct:typeToStrength(handResult.type),
        rc:handResult.type,
        handName:HAND_NAMES[handResult.type]||'HIGH CARD',
        tiebreak:handResult.tiebreak,
        suited:isSuited,pair:isPair,
      });
    }
  }
  return results.filter(Boolean);
}

function calcNuts(board){
  const boardCards=(board||[]).filter(Boolean);
  if(boardCards.length<3)return[];
  const deadSet=new Set(boardCards);
  const candidates=[];

  for(let i=0;i<13;i++){
    for(let j=i;j<13;j++){
      const r1=RANKS[i],r2=RANKS[j];
      const isPair=i===j;

      if(!isPair){
        for(let s=0;s<4;s++){
          const c1=r1+SUITS[s],c2=r2+SUITS[s];
          if(deadSet.has(c1)||deadSet.has(c2))continue;
          const all=[c1,c2,...boardCards];
          if(all.length>=5){const h=best5From7(all);candidates.push({c1,c2,hand:r1+r2+'s',...h});}
        }
      }
      for(let a=0;a<4;a++){
        for(let b=0;b<4;b++){
          if(isPair&&b<=a)continue;
          if(!isPair&&a===b)continue;
          const c1=r1+SUITS[a],c2=r2+SUITS[b];
          if(deadSet.has(c1)||deadSet.has(c2))continue;
          const all=[c1,c2,...boardCards];
          if(all.length>=5){
            const h=best5From7(all);
            candidates.push({c1,c2,hand:isPair?r1+r2:r1+r2+'o',...h});
          }
        }
      }
    }
  }

  candidates.sort((a,b)=>a.type!==b.type?a.type-b.type:b.tiebreak-a.tiebreak);
  const seen=new Set();const unique=[];
  for(const c of candidates){
    if(!seen.has(c.hand)){seen.add(c.hand);unique.push(c);}
  }
  return unique.slice(0,15).map((c,idx)=>({
    rank:idx+1,hand:c.hand,combo:c.c1+c.c2,
    rc:c.type,handName:HAND_NAMES[c.type]||'HIGH CARD',
    equity:typeToStrength(c.type),tiebreak:c.tiebreak,
  }));
}

const cache=new Map();
function cacheKey(board){return(board||[]).filter(Boolean).sort().join(',');}

self.onmessage=function(e){
  const{id,type,payload}=e.data;
  switch(type){
    case 'INIT':
      self.postMessage({type:'HELLO',version:'3.2'});
      break;
    case 'EVAL_169':{
      const key=cacheKey(payload.board);
      if(cache.has(key)){self.postMessage({id,type:'EVAL_169',cached:true,data:cache.get(key)});return;}
      const t0=performance.now();
      const data=eval169(payload.board,payload.hero);
      cache.set(key,data);
      self.postMessage({id,type:'EVAL_169',cached:false,calcTime:Math.round(performance.now()-t0),data});
      break;
    }
    case 'NUTS':{
      const key='nuts:'+cacheKey(payload.board);
      if(cache.has(key)){self.postMessage({id,type:'NUTS',cached:true,data:cache.get(key)});return;}
      const t0=performance.now();
      const data=calcNuts(payload.board);
      cache.set(key,data);
      self.postMessage({id,type:'NUTS',cached:false,calcTime:Math.round(performance.now()-t0),data});
      break;
    }
    case 'CACHE_CLEAR':
      cache.clear();self.postMessage({id,type:'CACHE_CLEAR',cleared:true});break;
    default:
      self.postMessage({id,type:'ERROR',error:'Unknown: '+type});
  }
};
console.log('[Spectra Worker v3.2] Ready');
