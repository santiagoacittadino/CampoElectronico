export const VERT_SRC = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const MAX_TOUCHES = 8;

export const FRAG_SRC = `
precision highp float;

varying vec2 v_uv;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_style;
uniform int u_touchCount;
uniform vec2 u_touchPos[${MAX_TOUCHES}];
uniform float u_touchLife[${MAX_TOUCHES}];
uniform float u_touchHue[${MAX_TOUCHES}];
uniform float u_touchAge[${MAX_TOUCHES}];

// ---- hash / noise (Ashima simplex 3D, trimmed) ----
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbm(vec3 p){
  float v = 0.0;
  float a = 0.5;
  for(int i=0;i<5;i++){
    v += a * snoise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

vec3 hsv2rgb(vec3 c){
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;

void main(){
  vec2 res = u_resolution;
  float aspect = res.x / res.y;
  vec2 p = (v_uv - 0.5);
  p.x *= aspect;

  vec2 warped = p;

  // style A: soft glow + vortex swirl
  float haloSumA = 0.0;
  float coreSumA = 0.0;
  vec3 glowColorA = vec3(0.0);

  // style B: radiating filaments (fiel a la referencia)
  float filSum = 0.0;
  vec3 filColor = vec3(0.0);
  float haloSumB = 0.0;
  float coreSumB = 0.0;
  vec3 glowColorB = vec3(0.0);

  float veinBoost = 0.0;

  for(int i=0;i<${MAX_TOUCHES}; i++){
    if(i >= u_touchCount) break;
    float life = u_touchLife[i];
    if(life <= 0.001) continue;

    vec2 tp = u_touchPos[i];
    tp = (tp - 0.5);
    tp.x *= aspect;

    vec2 d = p - tp;
    float dist = length(d) + 0.0001;
    float ang = atan(d.y, d.x);

    float swirlRadius = 0.5;
    float spin = u_touchAge[i] * 1.6;
    float swirl = life * 2.8 * exp(-dist / swirlRadius) + spin * 0.35 * exp(-dist / (swirlRadius*0.6));
    float newAng = ang + swirl;

    vec2 samplePos = tp + dist * vec2(cos(newAng), sin(newAng));
    float pull = smoothstep(0.85, 0.0, dist) * life;
    warped = mix(warped, samplePos, pull * 0.85);

    float hue = mix(0.52, 0.92, fract(u_touchHue[i]));
    vec3 touchColor = hsv2rgb(vec3(hue, 0.5, 1.0));
    float seed = fract(hue * 17.0 + float(i) * 3.71);

    veinBoost += life * exp(-dist / 0.22);

    // --- style A accumulation ---
    float haloA = smoothstep(0.5, 0.0, dist) * life;
    float coreA = smoothstep(0.09, 0.0, dist) * life;
    haloSumA += haloA;
    coreSumA += coreA;
    glowColorA += touchColor * haloA;

    // --- style B accumulation ---
    float coreRadius = 0.075;
    float bandNoise = snoise(vec3(cos(ang) * 3.0 + seed * 11.0, sin(ang) * 3.0, dist * 18.0 - u_time * 0.15));
    float mottle = 0.6 + 0.4 * smoothstep(-0.2, 0.6, bandNoise);
    float coreB = smoothstep(coreRadius, 0.0, dist) * life;
    float haloB = smoothstep(coreRadius * 2.4, 0.0, dist) * life;
    coreSumB += coreB * mottle;
    haloSumB += haloB;
    glowColorB += touchColor * (haloB * 0.6 + coreB * 0.25);

    float sectorCount = floor(mix(16.0, 24.0, seed));
    float sectorAngle = TWO_PI / sectorCount;
    float sector = floor(ang / sectorAngle + 0.5);
    float idealAngle = sector * sectorAngle;

    float rOut = mix(0.4, 0.58, seed) * (0.55 + 0.45 * life);
    float rIn = coreRadius * 0.9;
    float radiusT = clamp(dist / rOut, 0.0, 1.0);

    float jitterSeed = sector * 12.9898 + seed * 300.0;
    float wobble = snoise(vec3(jitterSeed, dist * 1.1, u_time * 0.05 + spin * 0.015));
    float jitterAmp = mix(0.015, 0.26, radiusT) * sectorAngle;
    float wavyAngle = idealAngle + wobble * jitterAmp;

    float angularDist = ang - wavyAngle;
    angularDist = mod(angularDist + PI, TWO_PI) - PI;
    float perpDist = abs(angularDist) * dist;

    float lineWidth = 0.0022 + dist * 0.0032;
    float lineCore = smoothstep(lineWidth, 0.0, perpDist);
    float lineGlow = smoothstep(lineWidth * 6.0, 0.0, perpDist);

    float envelope = life * smoothstep(rOut, rOut * 0.15, dist) * smoothstep(0.0, rIn, dist);
    float tipBand = smoothstep(rOut * 0.05, 0.0, abs(dist - rOut * 0.95));
    float tipFlare = tipBand * (lineCore * 1.4 + lineGlow * 0.4) * life;

    float filBright = (lineCore + lineGlow * 0.3) * envelope + tipFlare;

    filSum += filBright;
    filColor += mix(vec3(1.0), touchColor, 0.22) * filBright;
  }

  float t = u_time * 0.06;

  float base = fbm(vec3(warped * 2.6, t));
  float fine = fbm(vec3(warped * 7.0 + 12.3, t * 1.7));
  float flicker = fbm(vec3(warped * 3.0 - 5.0, u_time * 1.3));

  float staticNoise = base * 0.5 + fine * 0.5;
  staticNoise = staticNoise * 0.5 + 0.5;

  float veinsRaw = pow(abs(fine), mix(4.0, 5.0, u_style) - veinBoost * 2.2);
  float veins = smoothstep(mix(0.55, 0.6, u_style), 1.0, veinsRaw) * mix(0.35 + veinBoost * 0.6, 0.28 + veinBoost * 0.5, u_style);

  vec3 bg = mix(vec3(0.010, 0.012, 0.020), vec3(0.003, 0.003, 0.006), u_style);
  vec3 staticColor = mix(vec3(0.42, 0.5, 0.62), vec3(0.35, 0.4, 0.5), u_style);

  float ambientIntensity = mix(0.13 + veinBoost * 0.05, 0.035 + veinBoost * 0.015, u_style);
  vec3 color = bg + staticColor * staticNoise * ambientIntensity;
  color += mix(vec3(0.55, 0.7, 1.0), vec3(0.5, 0.65, 1.0), u_style) * veins;

  vec3 colorA = vec3(0.0);
  if(haloSumA > 0.0){
    float flickerAmt = 0.6 + 0.4 * (flicker * 0.5 + 0.5);
    float haloClamped = min(haloSumA, 1.6);
    float coreClamped = min(coreSumA, 1.2);
    colorA += glowColorA * haloClamped * 0.28 * flickerAmt;
    colorA += glowColorA * coreClamped * 0.45;
    colorA += vec3(1.0) * coreClamped * coreClamped * 0.1;
  }

  vec3 colorB = vec3(0.0);
  if(filSum > 0.0){
    colorB += filColor * min(filSum, 2.2);
  }
  if(haloSumB > 0.0){
    float haloClamped = min(haloSumB, 1.4);
    float coreClamped = min(coreSumB, 1.3);
    colorB += glowColorB * haloClamped * 0.4;
    colorB += glowColorB * coreClamped * 0.5;
    colorB += vec3(1.0) * coreClamped * coreClamped * 0.3;
  }

  color += mix(colorA, colorB, u_style);

  float vig = smoothstep(1.2, 0.2, length(p));
  float vigFactorA = mix(0.75, 1.0, vig);
  float vigFactorB = mix(0.85, 1.0, vig);
  color *= mix(vigFactorA, vigFactorB, u_style);

  color = color / (1.0 + color);
  color = pow(color, vec3(0.9));

  gl_FragColor = vec4(color, 1.0);
}
`;
