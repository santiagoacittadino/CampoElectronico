import { VERT_SRC, FRAG_SRC, MAX_TOUCHES } from './shaders.js';

function compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Shader compile error: ' + info);
  }
  return shader;
}

export class FieldRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' })
      || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL no soportado');
    this.gl = gl;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
    }
    this.program = program;
    gl.useProgram(program);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 3, -1, -1, 3,
    ]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    this.uniforms = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      time: gl.getUniformLocation(program, 'u_time'),
      style: gl.getUniformLocation(program, 'u_style'),
      touchCount: gl.getUniformLocation(program, 'u_touchCount'),
      touchPos: gl.getUniformLocation(program, 'u_touchPos'),
      touchLife: gl.getUniformLocation(program, 'u_touchLife'),
      touchHue: gl.getUniformLocation(program, 'u_touchHue'),
      touchAge: gl.getUniformLocation(program, 'u_touchAge'),
    };

    this.maxTouches = MAX_TOUCHES;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
  }

  resize() {
    const { canvas, gl } = this;
    const w = Math.floor(window.innerWidth * this.dpr);
    const h = Math.floor(window.innerHeight * this.dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    gl.viewport(0, 0, w, h);
  }

  render(time, touches, style) {
    const { gl, uniforms } = this;

    const n = Math.min(touches.length, this.maxTouches);
    const pos = new Float32Array(this.maxTouches * 2);
    const life = new Float32Array(this.maxTouches);
    const hue = new Float32Array(this.maxTouches);
    const age = new Float32Array(this.maxTouches);

    for (let i = 0; i < n; i++) {
      const t = touches[i];
      pos[i * 2] = t.x;
      pos[i * 2 + 1] = t.y;
      life[i] = t.life;
      hue[i] = t.hue;
      age[i] = t.age;
    }

    gl.uniform2f(uniforms.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(uniforms.time, time);
    gl.uniform1f(uniforms.style, style);
    gl.uniform1i(uniforms.touchCount, n);
    gl.uniform2fv(uniforms.touchPos, pos);
    gl.uniform1fv(uniforms.touchLife, life);
    gl.uniform1fv(uniforms.touchHue, hue);
    gl.uniform1fv(uniforms.touchAge, age);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
