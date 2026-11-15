// Original geometric mug illustration for reproducible vision integration tests.
const fs=require('node:fs'),zlib=require('node:zlib');
const w=256,h=256,pixels=Buffer.alloc(w*h*3);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 let color=[229,238,245];
 if(((x-128)/84)**2+((y-205)/13)**2<1)color=[193,205,214];
 const ring=((x-183)/39)**2+((y-129)/48)**2;
 const inside=((x-183)/23)**2+((y-129)/31)**2;
 if(ring<1 && inside>1)color=[177,71,42];
 if(x>=65&&x<=171&&y>=75&&y<=183)color=[196,83,49];
 if(((x-118)/53)**2+((y-183)/15)**2<1)color=[196,83,49];
 if(x>=76&&x<=84&&y>94&&y<173)color=[231,138,102];
 if(((x-118)/53)**2+((y-75)/15)**2<1)color=[234,164,126];
 if(((x-118)/44)**2+((y-74)/9)**2<1)color=[81,46,31];
 pixels.set(color,(y*w+x)*3);
}
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([size,name,data,crc]);}
const header=Buffer.alloc(13);header.writeUInt32BE(w,0);header.writeUInt32BE(h,4);header[8]=8;header[9]=2;
const rows=Buffer.alloc(h*(w*3+1));for(let y=0;y<h;y++)pixels.copy(rows,y*(w*3+1)+1,y*w*3,(y+1)*w*3);
fs.mkdirSync('scripts/fixtures',{recursive:true});fs.writeFileSync('scripts/fixtures/mug.png',Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));
console.log('Created scripts/fixtures/mug.png');
