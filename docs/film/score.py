import numpy as np, wave, pathlib
sr=48000; dur=60; n=sr*dur; t=np.arange(n,dtype=np.float64)/sr
l=np.zeros(n);r=np.zeros(n)
def add(start,length,fn,pan=0):
 a=int(start*sr);b=min(n,a+int(length*sr));u=np.arange(b-a)/sr;y=fn(u);l[a:b]+=y*np.sqrt((1-pan)/2);r[a:b]+=y*np.sqrt((1+pan)/2)
def env(u,a,d):return np.minimum(1,u/a)*np.exp(-u/d)
# An original sparse minor ninth score: sub foundation, bowed harmonics, glass ostinato.
chords=[(0,10,[146.832,220,261.626,329.628]),(10,13,[130.813,196,261.626,293.665]),(23,12,[116.541,174.614,233.082,293.665]),(35,7,[130.813,196,261.626,329.628]),(42,11,[146.832,220,293.665,349.228]),(53,7,[146.832,220,293.665,329.628])]
for st,d,notes in chords:
 for j,f in enumerate(notes):
  add(st,d+.7,lambda u,f=f,d=d,j=j: .038*np.minimum(1,u/1.8)*np.minimum(1,np.maximum(0,d+.7-u)/1.5)*(np.sin(2*np.pi*f*u+.5*np.sin(u*.4))+ .23*np.sin(2*np.pi*(f*2+.15)*u))*(.8+.2*np.sin(u*.23+j)),(j-1.5)*.35)
for st in [0,6,10,18,23,35,42,53]:
 add(st,2.8,lambda u:.30*env(u,.012,.65)*np.sin(2*np.pi*(39*u+20*.12*(1-np.exp(-u/.12)))))
 # Metallic partials share the same short synthetic room tail.
 for j,rat in enumerate([1,1.51,2.73,4.07]):
  add(st+.03,2.5,lambda u,j=j,rat=rat: .024/(j+1)*env(u,.003,1.1)*np.sin(2*np.pi*330*rat*u),(-1)**j*.45)
for st,end in [(23,35),(42,53)]:
 for k,at in enumerate(np.arange(st+.625,end,.625)):
  note=[293.665,440,523.251,659.255,587.33,440,349.228,440][k%8]
  add(at,1.25,lambda u,f=note:.068*env(u,.003,.25)*(np.sin(2*np.pi*f*u)+.15*np.sin(2*np.pi*f*3*u)),np.sin(k*1.3)*.7)
  if k%2==0:add(at,.3,lambda u:.14*env(u,.002,.075)*np.sin(2*np.pi*(45*u+3*(1-np.exp(-u/.03)))))
# Seeded air tied to assembly speed; two designed silences make the next chapter land.
rng=np.random.default_rng(7734);noise=rng.standard_normal(n);air=np.convolve(noise,np.ones(18)/18,mode='same');amp=np.zeros(n)
for st in [5.15,9.1,17.1,22.1,34.1,41.1,52.1]:amp+=.035*np.exp(-((t-st)/.48)**2)
l+=air*amp;r+=np.roll(air,311)*amp
sil=np.ones(n)
for a,b in [(9.45,10),(41.5,42)]:
 sil*=np.where((t>=a)&(t<b),0,np.where((t>=a-.08)&(t<a),(a-t)/.08,np.where((t>=b)&(t<b+.01),(t-b)/.01,1)))
fade=np.minimum(1,t/.015)*np.minimum(1,np.maximum(0,60-t)/1.1)*sil
out=np.stack([np.tanh(l)*fade,np.tanh(r)*fade],axis=1)
p=pathlib.Path(__file__).parent/'score.wav'
with wave.open(str(p),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((out*32760).astype('<i2').tobytes())
print('Original 60 second stereo score: '+str(p))
