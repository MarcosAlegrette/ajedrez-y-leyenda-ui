import sharp from 'sharp'
const base='/Users/marcosalegrette/Desktop/Workspace Micelium/ajedrezyleyendaweb/app/public/assets/'
const files=process.argv.slice(3)
const W=1500; let x=0,y=0,rowH=0; const comps=[]
for(const f of files){
  let s=sharp(base+f); const m=await s.metadata(); let w=m.width,h=m.height
  const max=+(process.env.MAX||260); if(w>max||h>max){const k=Math.min(max/w,max/h); w=Math.round(w*k);h=Math.round(h*k); s=s.resize(w,h)}
  if(x+w>W){x=0;y+=rowH+22;rowH=0}
  comps.push({input:await s.png().toBuffer(),left:x,top:y+14})
  const label=Buffer.from(`<svg width="${Math.max(w,120)}" height="14"><text x="0" y="11" font-size="11" fill="#ff0" font-family="monospace">${f.split('/').pop().replace('.webp','')} ${m.width}x${m.height}</text></svg>`)
  comps.push({input:label,left:x,top:y})
  x+=Math.max(w,120)+8; rowH=Math.max(rowH,h+14)
}
await sharp({create:{width:W,height:y+rowH+20,channels:3,background:'#446'}}).composite(comps).png().toFile(process.argv[2])
