#!/usr/bin/env python3
"""Génère le bloc « mode sombre » de style.css (@media prefers-color-scheme: dark) à partir du CSS clair.
   Usage : python3 tools/gen-dark.py        (idempotent : remplace le bloc entre les marqueurs DARK:BEGIN / DARK:END)
   À relancer après toute modification de couleurs dans le CSS clair. Ne touche jamais au thème clair."""
import re,colorsys,sys,os
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
P=os.path.join(ROOT,'style.css')
BEGIN='/* ===== DARK:BEGIN (généré par tools/gen-dark.py — ne pas éditer à la main) ===== */'
END='/* ===== DARK:END ===== */'
src=open(P,encoding='utf-8').read()
if BEGIN in src: src=src[:src.index(BEGIN)].rstrip()+'\n'
css=re.sub(r'/\*.*?\*/','',src,flags=re.S)

CARD=(23,33,42)   # --card sombre
def parse(c):
    c=c.strip()
    if c.startswith('#'):
        h=c[1:]
        if len(h) in(3,4): h=''.join(x*2 for x in h)
        r,g,b=int(h[0:2],16),int(h[2:4],16),int(h[4:6],16);a=int(h[6:8],16)/255 if len(h)==8 else 1.0
        return r,g,b,a
    m=re.match(r'rgba?\(([^)]*)\)',c)
    if m:
        p=[x.strip() for x in re.split(r'[,/\s]+',m.group(1).strip()) if x.strip()]
        r,g,b=[int(float(x)) for x in p[:3]];a=float(p[3]) if len(p)>3 else 1.0
        return r,g,b,a
    return None
def fmt(r,g,b,a):
    return '#%02x%02x%02x'%(r,g,b) if a>=0.999 else 'rgba(%d,%d,%d,%.2f)'%(r,g,b,a)
def hls(r,g,b): return colorsys.rgb_to_hls(r/255,g/255,b/255)
def rgb(h,l,s): 
    r,g,b=colorsys.hls_to_rgb(h,max(0,min(1,l)),max(0,min(1,s)));return int(round(r*255)),int(round(g*255)),int(round(b*255))
def lum(r,g,b):
    f=lambda v:(v/255/12.92) if v/255<=0.03928 else (((v/255)+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def contrast(a,b):
    la,lb=lum(*a[:3]),lum(*b[:3]);hi,lo=max(la,lb),min(la,lb);return (hi+0.05)/(lo+0.05)
def tf(kind,c):
    p=parse(c)
    if not p: return None
    r,g,b,a=p
    h,l,s=hls(r,g,b)
    if kind=='bg':
        if a<0.9: return None
        if l<0.62: return None
        if (r,g,b)==(255,255,255): return 'var(--card)'
        nl=min(0.30,max(0.12,0.14+(1-l)*0.6));return fmt(*rgb(h,nl,s*0.55),a)
    if kind=='text':
        if l>0.46: return None
        nl=min(0.92,max(0.66,1-l));return fmt(*rgb(h,nl,s),a)
    if kind=='border':
        if a<0.9 or l<0.7: return None
        nl=0.22+(1-l)*0.3;return fmt(*rgb(h,nl,s*0.4),a)
    return None
COL=re.compile(r'#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\([^)]*\)')
def kind_of(prop):
    p=prop.strip().lower()
    if p.startswith('background'): return 'bg'
    if p in('color','fill','caret-color','text-decoration-color','-webkit-text-fill-color'): return 'text'
    if p.startswith('border') or p.startswith('outline') or p=='stroke': return 'border'
    return None
def decls(body):
    out=[];cur='';d=0
    for ch in body:
        if ch=='(':d+=1
        elif ch==')':d-=1
        if ch==';' and d==0: out.append(cur);cur=''
        else: cur+=ch
    if cur.strip(): out.append(cur)
    res=[]
    for x in out:
        if ':' in x:
            k,v=x.split(':',1);res.append((k.strip(),v.strip()))
    return res

# usage des jetons (fond vs texte)
tok_bg={};tok_tx={}
for m in re.finditer(r'(background[a-z-]*|color)\s*:\s*([^;}]*)',css):
    for t in re.findall(r'var\(--([a-z-]+)\)',m.group(2)):
        (tok_tx if m.group(1)=='color' else tok_bg)[t]=tok_bg.get(t,0)+1 if m.group(1)!='color' else tok_tx.get(t,0)+1
rules=[]
for m in re.finditer(r'([^{}]+)\{([^{}]*)\}',css):
    sel=m.group(1).strip()
    if not sel or re.match(r'^(\d+%|from|to)(\s*,.*)?$',sel) or sel.startswith('@'): continue
    rules.append((sel,decls(m.group(2))))

out=[];stats={'rules':0,'changed':0,'forced':0,'prim':0}
pairs=[]
for sel,ds in rules:
    ov=[];has_color=any(k.lower()=='color' for k,_ in ds);kept_mid_bg=False
    for k,v in ds:
        imp=' !important' if '!important' in v else ''
        vv=v.replace('!important','').strip()
        kd=kind_of(k)
        if k.lower()=='color' and re.search(r'var\(--(primary|primary-d)\)',vv):
            ov.append('color:var(--primary-ink)'+imp);stats['prim']+=1;continue
        if k.lower().startswith('border') and re.search(r'var\(--(primary-d)\)',vv): pass
        if not kd: continue
        new=vv;ch=False
        if kd=='bg' and re.search(r'var\(--(ink|muted)\)',vv):
            new=re.sub(r'var\(--ink\)','#2d3d4b',new);new=re.sub(r'var\(--muted\)','#3a4956',new);ch=True
        for c in set(COL.findall(vv)):
            t=tf(kd,c)
            if t and t!=c: new=new.replace(c,t);ch=True
            elif kd=='bg' and not t:
                p=parse(c)
                if p and p[3]>=0.9 and hls(*p[:3])[1]>=0.45: kept_mid_bg=True
        if ch: ov.append(k+':'+new+imp)
    if kept_mid_bg and not has_color: ov.append('color:#16242e');stats['forced']+=1
    stats['rules']+=1
    if ov:
        stats['changed']+=1;out.append(sel+'{'+';'.join(ov)+'}')

TOK=''':root{color-scheme:dark;
  --primary-ink:#8fc3ec;--ink:#e6edf3;--muted:#9fb0bd;--line:#2a3743;
  --bg:#0e151b;--card:#17212a;--none-bg:#1e2a34;
  --done-bg:#16301f;--done-line:#2f6b45;--done-ink:#7fd6a2;
  --danger-ink:#ff8d82;--bg2:#17212a;--focus:#8fc3ec;--tint:#1c2a36;--tint2:#241f33}
.ch-p{stroke:#8fc3ec}
html,body{background:var(--bg);color:var(--ink)}
input,select,textarea{color:var(--ink)}
input::placeholder,textarea::placeholder{color:#6f8190}
::selection{background:#2b5f8c;color:#fff}'''
# --danger : texte seulement ?
dang_bg=tok_bg.get('danger',0)
if dang_bg==0: TOK=TOK.replace('--danger-ink:#ff8d82;','--danger:#ff8d82;')
block=BEGIN+'\n@media (prefers-color-scheme: dark){\n'+TOK+'\n'+'\n'.join(out)+'\n}\n@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}\n'+END+'\n'
open(P,'w',encoding='utf-8').write(src.rstrip()+'\n\n'+block)
print('règles:',stats['rules'],'| surchargées en sombre:',stats['changed'],'| couleur forcée (fond moyen sans color):',stats['forced'],'| texte --primary → --primary-ink:',stats['prim'])
print('jetons utilisés en fond:',{k:v for k,v in tok_bg.items() if k in('primary','primary-d','danger','accent','done-ink')},'| en texte:',{k:v for k,v in tok_tx.items() if k in('primary','primary-d','danger','accent')})

# ---------------- contrôle des contrastes (python3 tools/gen-dark.py --check) ----------------
if '--check' in sys.argv:
    TV={'ink':'#e6edf3','muted':'#9fb0bd','line':'#2a3743','bg':'#0e151b','card':'#17212a','none-bg':'#1e2a34','done-bg':'#16301f','done-line':'#2f6b45','done-ink':'#7fd6a2',
        'primary-ink':'#8fc3ec','danger':'#ff8d82','danger-ink':'#ff8d82','primary':'#12466B','primary-d':'#0d3552','accent':'#F4622B','bg2':'#17212a','focus':'#8fc3ec'}
    def resolve(v):
        v=v.replace('!important','').strip()
        m=re.search(r'var\(--([a-z0-9-]+)\)',v)
        if m and m.group(1) in TV: return parse(TV[m.group(1)])
        m=COL.search(v)
        return parse(m.group(0)) if m else None
    bad=[];n=0
    for sel,ds in rules:
        eff={}
        for k,v in ds:
            kd=kind_of(k)
            if kd not in('bg','text'): continue
            vv=v.replace('!important','').strip()
            if kd=='text' and re.search(r'var\(--(primary|primary-d)\)',vv): vv='var(--primary-ink)'
            elif kd:
                new=vv
                if kd=='bg':
                    new=re.sub(r'var\(--ink\)','#2d3d4b',new);new=re.sub(r'var\(--muted\)','#3a4956',new)
                for c in set(COL.findall(vv)):
                    t=tf(kd,c)
                    if t: new=new.replace(c,t)
                vv=new
            col=resolve(vv)
            if col: eff[kd]=col
        fg=eff.get('text');bgc=eff.get('bg')
        if fg and bgc and bgc[3]>=0.9 and fg[3]>=0.9:
            n+=1;r=contrast(fg,bgc)
            if r<3.0: bad.append((round(r,2),sel[:60],fmt(*fg),fmt(*bgc)))
        elif fg and fg[3]>=0.9 and not bgc:
            n+=1;r=contrast(fg,(23,33,42,1))
            if r<3.0: bad.append((round(r,2),sel[:60],fmt(*fg),'(fond carte)'))
    bad.sort()
    print('paires fond/texte contrôlées:',n,'| sous 3:1 :',len(bad))
    for b in bad[:40]: print(' ',b)
