// Paul Kellet's refined pink noise algorithm
// Independent per-channel state for natural stereo noise
class PinkNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Two independent noise state arrays for stereo (left, right)
    this.state = [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ];
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const channelCount = Math.min(output.length, 2);

    for (let ch = 0; ch < channelCount; ch++) {
      const data = output[ch];
      const s = this.state[ch];

      for (let i = 0; i < data.length; i++) {
        const w = Math.random() * 2 - 1;
        s[0] = 0.99886 * s[0] + w * 0.0555179;
        s[1] = 0.99332 * s[1] + w * 0.0750759;
        s[2] = 0.96900 * s[2] + w * 0.1538520;
        s[3] = 0.86650 * s[3] + w * 0.3104856;
        s[4] = 0.55000 * s[4] + w * 0.5329522;
        s[5] = -0.7616 * s[5] - w * 0.0168980;
        const pink = s[0] + s[1] + s[2] + s[3] + s[4] + s[5] + s[6] + w * 0.5362;
        s[6] = w * 0.115926;
        data[i] = pink * 0.11;
      }
    }

    // Mono: copy left to right if only one output channel
    if (output.length === 1 && output[0]) {
      // already done
    }

    return true; // keep processor alive
  }
}

registerProcessor('pink-noise-processor', PinkNoiseProcessor);
