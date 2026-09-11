import React from 'react';

export function LogoTrenggalekSVG({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 240" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Outer White Margin & Outer Black Border */}
      <path
        d="M 100,5 C 135,5 160,18 165,18 C 172,18 178,8 183,10 C 187,12 188,22 189,32 C 189,145 160,205 100,238 C 40,205 11,145 11,32 C 12,22 13,12 17,10 C 22,8 28,18 35,18 C 40,18 65,5 100,5 Z"
        fill="#ffffff"
        stroke="#1a1a1a"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      
      {/* Inner Green Shield Body */}
      <path
        d="M 100,9 C 133,9 157,21 162,21 C 168,21 174,12 178,14 C 181,16 182,24 183,33 C 183,141 156,198 100,230 C 44,198 17,141 17,33 C 18,24 19,16 22,14 C 26,12 32,21 38,21 C 43,21 67,9 100,9 Z"
        fill="#009e49"
        stroke="#1a1a1a"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* 2. Faceted 3D Metallic Yellow Star at Top Center */}
      <g transform="translate(100, 28)">
        <polygon
          points="0,-16 4.7,-4.8 15.2,-4.8 6.7,1.8 10,12 0,5.5 -10,12 -6.7,1.8 -15.2,-4.8 -4.7,-4.8"
          fill="#ffeb3b"
          stroke="#1a1a1a"
          strokeWidth="0.8"
        />
        <polygon points="0,-16 0,0 4.7,-4.8" fill="#1a1a1a" opacity="0.35" />
        <polygon points="15.2,-4.8 0,0 6.7,1.8" fill="#1a1a1a" opacity="0.35" />
        <polygon points="10,12 0,0 0,5.5" fill="#1a1a1a" opacity="0.35" />
        <polygon points="-10,12 0,0 -6.7,1.8" fill="#1a1a1a" opacity="0.35" />
        <polygon points="-15.2,-4.8 0,0 -4.7,-4.8" fill="#1a1a1a" opacity="0.35" />
      </g>

      {/* 3. Cotton (Left Branch) */}
      <g>
        <path d="M 45,142 C 30,105 45,65 78,50" fill="none" stroke="#ffffff" strokeWidth="2.5" />
        <path d="M 45,142 C 30,105 45,65 78,50" fill="none" stroke="#1a1a1a" strokeWidth="0.8" />
        {[
          { cx: 43, cy: 135, r: 5.5 },
          { cx: 37, cy: 122, r: 5.5 },
          { cx: 33, cy: 108, r: 5.5 },
          { cx: 32, cy: 94, r: 5.5 },
          { cx: 35, cy: 80, r: 5.5 },
          { cx: 42, cy: 68, r: 5.5 },
          { cx: 52, cy: 58, r: 5.5 },
          { cx: 65, cy: 52, r: 5.5 },
        ].map((c, i) => (
          <g key={i}>
            <circle cx={c.cx} cy={c.cy} r={c.r} fill="#ffffff" stroke="#1a1a1a" strokeWidth="0.8" />
            <path
              d={`M ${c.cx - 2},${c.cy + 3} L ${c.cx},${c.cy + 6} L ${c.cx + 2},${c.cy + 3} Z`}
              fill="#006b31"
            />
          </g>
        ))}
      </g>

      {/* 4. Paddy / Rice (Right Branch) */}
      <g>
        <path d="M 155,142 C 170,105 155,65 122,50" fill="none" stroke="#1a1a1a" strokeWidth="1" />
        {[
          { cx: 157, cy: 135, rot: 25 },
          { cx: 163, cy: 122, rot: 30 },
          { cx: 167, cy: 108, rot: 35 },
          { cx: 168, cy: 94, rot: 40 },
          { cx: 165, cy: 80, rot: 45 },
          { cx: 158, cy: 68, rot: 50 },
          { cx: 148, cy: 58, rot: 55 },
          { cx: 135, cy: 52, rot: 60 },
        ].map((p, i) => (
          <g key={i} transform={`translate(${p.cx}, ${p.cy}) rotate(${p.rot})`}>
            <ellipse cx="0" cy="0" rx="3.5" ry="6" fill="#ffeb3b" stroke="#1a1a1a" strokeWidth="0.7" />
          </g>
        ))}
      </g>

      {/* 5. Central Emblem (Red Outer Chain Ring + Yellow Sun + Mountains + Waves) */}
      <g transform="translate(100, 102)">
        <circle cx="0" cy="0" r="42" fill="#e31e24" stroke="#1a1a1a" strokeWidth="1.5" />
        <circle cx="0" cy="0" r="37" fill="none" stroke="#ffffff" strokeWidth="3" strokeDasharray="4 2.5" />
        <circle cx="0" cy="0" r="32" fill="#ffeb3b" stroke="#1a1a1a" strokeWidth="1" />

        <g clipPath="url(#discClip)">
          <rect x="-35" y="0" width="70" height="35" fill="#0088cc" />
          <polygon points="-28,2 -10,-22 5,2" fill="#212121" />
          <polygon points="-8,2 8,-25 28,2" fill="#37474f" />
          <path d="M -10,-22 L -14,-8 L -8,2" fill="none" stroke="#ffffff" strokeWidth="1" />
          <path d="M 8,-25 L 4,-8 L 8,2" fill="none" stroke="#ffffff" strokeWidth="1" />

          <path d="M -35,5 Q -20,8 -5,5 Q 10,2 25,5 Q 35,7 40,5" fill="none" stroke="#ffffff" strokeWidth="1.2" />
          <path d="M -35,11 Q -20,14 -5,11 Q 10,8 25,11 Q 35,13 40,11" fill="none" stroke="#ffffff" strokeWidth="1.2" />
          <path d="M -35,17 Q -20,20 -5,17 Q 10,14 25,17 Q 35,19 40,17" fill="none" stroke="#ffffff" strokeWidth="1.2" />
          <path d="M -35,23 Q -20,26 -5,23 Q 10,20 25,23 Q 35,25 40,23" fill="none" stroke="#ffffff" strokeWidth="1.2" />
        </g>
        
        <circle cx="0" cy="0" r="32" fill="none" stroke="#1a1a1a" strokeWidth="1" />
      </g>

      <defs>
        <clipPath id="discClip">
          <circle cx="0" cy="0" r="31.5" />
        </clipPath>
      </defs>

      {/* 6. Fortress / Gate Wall (Benteng) */}
      <g transform="translate(100, 155)">
        <path
          d="M -50,-6 L 50,-6 L 50,6 L 36,6 L 36,0 L 22,0 L 22,6 L 7,6 L 7,0 L -7,0 L -7,6 L -22,6 L -22,0 L -36,0 L -36,6 L -50,6 Z"
          fill="#1a1a1a"
          stroke="#ffffff"
          strokeWidth="1.2"
        />
        <rect x="-50" y="6" width="100" height="2" fill="#1a1a1a" />
      </g>

      {/* 7. Bottom Red Ribbon Banner (Pita Merah JWALITA PRAJA KARANA) */}
      <g transform="translate(100, 182)">
        <polygon points="-75,12 -90,22 -72,25 -75,12" fill="#b71c1c" stroke="#1a1a1a" strokeWidth="0.8" />
        <polygon points="75,12 90,22 72,25 75,12" fill="#b71c1c" stroke="#1a1a1a" strokeWidth="0.8" />
        
        <path
          d="M -78,6 Q 0,22 78,6 L 75,22 Q 0,38 -75,22 Z"
          fill="#e31e24"
          stroke="#1a1a1a"
          strokeWidth="1.2"
        />
        
        <path id="bannerPath" d="M -72,20 Q 0,35 72,20" fill="none" />
        <text fill="#ffffff" fontSize="9" fontWeight="900" fontFamily="sans-serif" letterSpacing="0.8" textAnchor="middle">
          <textPath href="#bannerPath" startOffset="50%">JWALITA PRAJA KARANA</textPath>
        </text>
      </g>
    </svg>
  );
}

export function LogoPuskesmasBaruharjoSVG({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 240" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Outer Circle Accent */}
      <circle cx="120" cy="115" r="105" fill="none" stroke="#8bc34a" strokeWidth="6" />
      <circle cx="120" cy="115" r="98" fill="none" stroke="#ffb300" strokeWidth="3" />

      {/* Top Arched Text: PUSKESMAS */}
      <path id="puskesmasTextPath" d="M 35,100 A 90,90 0 0,1 205,100" fill="none" />
      <text fill="#004d20" fontSize="18" fontWeight="900" fontFamily="sans-serif" textAnchor="middle" letterSpacing="2">
        <textPath href="#puskesmasTextPath" startOffset="50%">PUSKESMAS</textPath>
      </text>

      {/* Bottom Arched Text: BARUHARJO */}
      <path id="baruharjoTextPath" d="M 30,135 A 90,90 0 0,0 210,135" fill="none" />
      <text fill="#004d20" fontSize="20" fontWeight="900" fontFamily="sans-serif" textAnchor="middle" letterSpacing="2">
        <textPath href="#baruharjoTextPath" startOffset="50%">BARUHARJO</textPath>
      </text>

      {/* Left Leaves */}
      <g fill="#4caf50">
        <path d="M 52,65 C 40,50 60,40 68,52 C 60,62 52,65 52,65 Z" />
        <path d="M 65,75 C 50,65 65,50 78,60 C 72,72 65,75 65,75 Z" />
      </g>

      {/* Right Leaves */}
      <g fill="#4caf50">
        <path d="M 188,65 C 200,50 180,40 172,52 C 180,62 188,65 188,65 Z" />
        <path d="M 175,75 C 190,65 175,50 162,60 C 168,72 175,75 175,75 Z" />
      </g>

      {/* Left Abstract Green Person */}
      <circle cx="55" cy="100" r="10" fill="#2e7d32" />
      <path d="M 38,135 C 32,105 60,110 70,120 C 62,135 48,142 38,135 Z" fill="#2e7d32" />

      {/* Right Abstract Orange Person */}
      <circle cx="185" cy="100" r="10" fill="#f57c00" />
      <path d="M 202,135 C 208,105 180,110 170,120 C 178,135 192,142 202,135 Z" fill="#f57c00" />

      {/* Center Hexagon */}
      <polygon
        points="120,55 160,78 160,124 120,147 80,124 80,78"
        fill="#ffffff"
        stroke="#005c28"
        strokeWidth="4"
      />

      {/* Medical Cross + House inside Hexagon */}
      <g fill="#005c28">
        {/* Vertical Cross Arm */}
        <rect x="110" y="70" width="20" height="60" rx="2" />
        {/* Horizontal Cross Arm */}
        <rect x="90" y="90" width="60" height="20" rx="2" />
        {/* House Roof on Right Side */}
        <path d="M 120,88 L 152,110 L 120,110 Z" fill="#005c28" />
        <path d="M 122,92 L 148,110 L 122,110 Z" fill="#ffffff" />
        {/* Interlocked Rings inside Roof */}
        <circle cx="132" cy="104" r="4" fill="none" stroke="#005c28" strokeWidth="1.5" />
        <circle cx="138" cy="104" r="4" fill="none" stroke="#005c28" strokeWidth="1.5" />
      </g>

      {/* Heart Emblem at Hexagon Bottom */}
      <path
        d="M 120,145 C 112,135 105,142 110,150 C 115,158 120,162 120,162 C 120,162 125,158 130,150 C 135,142 128,135 120,145 Z"
        fill="#ff9800"
        stroke="#005c28"
        strokeWidth="1.5"
      />

      {/* Green Banner at Bottom */}
      <g>
        <path d="M 40,175 Q 120,185 200,175 L 208,198 L 195,192 Q 120,202 45,192 L 32,198 Z" fill="#1b5e20" />
        <path id="bannerTextPath" d="M 45,188 Q 120,198 195,188" fill="none" />
        <text fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle" letterSpacing="1">
          <textPath href="#bannerTextPath" startOffset="50%">MITRA ANDA SEHAT</textPath>
        </text>
        {/* Little Yellow Hearts on Banner */}
        <path d="M 50,182 C 48,179 45,181 47,184 L 50,187 L 53,184 C 55,181 52,179 50,182 Z" fill="#ffd700" />
        <path d="M 190,182 C 188,179 185,181 187,184 L 190,187 L 193,184 C 195,181 192,179 190,182 Z" fill="#ffd700" />
      </g>

      {/* Tagline below banner */}
      <text x="120" y="215" textAnchor="middle" fill="#004d20" fontSize="10" fontWeight="bold" fontFamily="serif" fontStyle="italic">
        Tulus Melayani, Sehatkan Negeri
      </text>
    </svg>
  );
}

export function LogoUKSSVG({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Outer Yellow Triangle */}
      <polygon points="100,10 190,165 10,165" fill="#fbc02d" stroke="#f57f17" strokeWidth="4" />
      
      {/* Outer Green Border Circle */}
      <circle cx="100" cy="110" r="48" fill="#ffffff" stroke="#2e7d32" strokeWidth="5" />
      
      {/* Green Cross */}
      <rect x="91" y="80" width="18" height="60" fill="#2e7d32" rx="2" />
      <rect x="70" y="101" width="60" height="18" fill="#2e7d32" rx="2" />

      {/* Text UKS */}
      <text x="100" y="52" textAnchor="middle" fill="#1b5e20" fontSize="20" fontWeight="900" fontFamily="sans-serif">
        UKS
      </text>
      
      <text x="100" y="185" textAnchor="middle" fill="#1b5e20" fontSize="11" fontWeight="extrabold" fontFamily="sans-serif">
        USAHA KESEHATAN SEKOLAH
      </text>
    </svg>
  );
}
