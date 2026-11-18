/* Gentle, reversible cleanup. Original recording IDs remain in the lesson. */
const StudioAudio = {
  async clean(bytes) {
    const ctx = new AudioContext();
    let decoded;
    try { decoded = await ctx.decodeAudioData(bytes); } finally { await ctx.close(); }
    if (decoded.duration > 45) throw new Error(StudioI18n.t('Keep voice recordings under 45 seconds.'));
    const rate = 16000, offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
    const source = offline.createBufferSource(), filter = offline.createBiquadFilter();
    source.buffer = decoded; filter.type = 'highpass'; filter.frequency.value = 75;
    source.connect(filter).connect(offline.destination); source.start();
    const rendered = await offline.startRendering(), samples = rendered.getChannelData(0);
    let peak = 0; for (const v of samples) peak = Math.max(peak, Math.abs(v));
    // Never amplify silence or boost noisy recordings more than 6 dB.
    const gain = peak > 0.01 ? Math.min(2, 0.85 / peak) : 1;
    const buffer = new ArrayBuffer(44 + samples.length * 2), view = new DataView(buffer);
    const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset+i,c.charCodeAt(0)));
    text(0,'RIFF');view.setUint32(4,36+samples.length*2,true);text(8,'WAVE');text(12,'fmt ');
    view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
    view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
    text(36,'data');view.setUint32(40,samples.length*2,true);
    samples.forEach((v,i)=>view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,v*gain))*32767),true));
    return new Blob([buffer],{type:'audio/wav'});
  }
};
