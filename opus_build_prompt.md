Ultrathink. You are building a complete hackathon web app from an empty folder, running fully autonomously in the background with nobody watching. Work through every phase in section 11 to the end without stopping.

How to work:
- Before writing code, think deeply about the architecture, data model and page flow, then write PLAN.md with the full plan and a checklist mapped to sections 1 to 13. Keep a task list and update it as you go.
- Never stop to ask questions and never wait for confirmation. When something is ambiguous, think it through, pick the most reasonable option, log it in DECISIONS.md, and keep going.
- Verify your own work. After each phase, run lint, typecheck, tests and the production build, fix every error, take Playwright screenshots and look at them critically. If a page looks cluttered, cramped, misaligned or generic, redesign it before moving on.
- If something fails, debug it properly: read the actual error, check the real docs or node_modules, and try a different approach before falling back. Do not leave broken code behind; a smaller feature that works beats a larger one that doesn't.
- Commit after every working milestone with a clear message.
- Do not end your run until all four phases are done, or until you've genuinely exhausted options on something and documented it in STATUS.md. Finish by writing STATUS.md.

Hard deadline: Devpost submission at 11:00 AM Sunday, so favor a working, polished core over breadth.

# 1. Product

A hardware project builder website with two equal starting paths:

1. Start From a Device: pick a device category (the full list is in section 5). See the generic insides of that kind of device as labeled blocks in an interactive 3D exploded view, then open a maker-scale starter build of it with real parts.
2. Start From Scratch: open an empty canvas and build any project from real modules (microcontrollers, sensors, displays, motors, power parts).

In both paths the user places modules and wires them. The site instantly runs checks (power budget, voltage compatibility, pin allocation, I2C address conflicts, cost, board fit) and shows advice as sticky notes. One click turns the build into a schematic, a carrier PCB layout and a 3D board view, with exports (Gerber, BOM, KiCad) and a manufacturing quote. The whole site can be controlled by hand gestures (webcam hand tracking plus an optional Bluetooth gesture ring that acts as a keyboard).

It is a polished product, not an AI agent. There is NO chat box, no conversational UI, no "AI assistant" wording anywhere in the interface.

# 2. Tech stack

- Next.js (latest stable, App Router) + TypeScript (strict) + Tailwind CSS. State with Zustand.
- Schematic, PCB, autorouting, 3D board and exports: tscircuit (MIT). Before using any tscircuit package, check the real package names, versions and APIs on npm and in node_modules or the official docs. Do not guess APIs. Expected building blocks: @tscircuit/core to turn components and connections into Circuit JSON, and the viewer components (schematic viewer, PCB viewer, 3D viewer, or @tscircuit/runframe). Use whatever the current docs say. If integration blocks you for more than ~45 minutes, build a simple fallback SVG schematic and PCB renderer, log it in DECISIONS.md, and keep going.
- Device exploded views: react-three-fiber + drei. Build devices from simple procedural geometry (rounded boxes, cylinders, planes) with clean materials. Do not use any copyrighted brand models or images.
- Hand tracking: MediaPipe Tasks Vision (hand landmarker) in the browser, lazy-loaded only when the user turns gestures on.
- Tests: Vitest for logic, Playwright for page checks and screenshots.
- Database: MongoDB Atlas via an adapter (see section 9). Every external service sits behind an adapter with a local mock fallback, so the app runs with zero API keys.

# 3. Design system: classy, clean, no scrolling

- Every page is exactly one screen: html and body use 100vh with overflow hidden. Never use page scroll. Panels that hold lists use tabs or pagination (page dots or arrows), never scrollbars.
- Navigate between pages with arrow keys, on-screen arrows, page dots and hand swipes. Animate page changes with a slow, subtle fade or slide.
- Colors: background warm off-white #F5F2EC, ink #16181C, muted text #6B6B6B, hairline borders #E2DDD3, single accent copper #B5652E (like PCB traces), success #3F7D58, warning #C08A2B, danger #B4483C. PCB view uses a dark charcoal background #1B1D20 with copper traces.
- Type: Instrument Serif (or Fraunces) for headlines, Inter (or Geist) for UI, Geist Mono or JetBrains Mono for specs and numbers. Load with next/font.
- Layout: strict 8px grid, generous white space, 1px hairline borders, 12px corner radius, very soft shadows only on floating elements. No gradients, no glows, no neon.
- Icons: thin line icons (lucide-react), 1.5px stroke.
- Hand cursor: a thin copper ring that follows the tracked hand and fills when a pinch is held.
- Accessibility: full keyboard navigation, visible focus rings, prefers-reduced-motion support, a high-contrast toggle, and readable contrast ratios.

# 4. Pages

1. Home: large serif headline, one short subline, two equal primary blocks: "Start From a Device" and "Start From Scratch", plus a smaller "Templates" block. Small mascot slot in a corner (use a placeholder SVG at /public/mascot.svg that the team will replace).
2. Devices: a 4×3 grid of the 12 category blocks in the exact order listed in section 5, each with a line icon, name and one-line description. Custom is always first and opens an empty Builder. More (Coming Soon) is always last, shown slightly muted with "(Coming Soon)" in the label, and opens a small one-screen notice instead of a category page.
3. Category: left half is the 3D exploded view of the generic device (blocks like Processor, Memory, Power, Display, Battery, Sensors, Connectivity, Enclosure). Hovering or pointing at a block highlights it and shows a short description. Right half shows 2 or 3 starter build cards that open in the Builder.
4. Builder: left parts palette (tabbed by type: Controllers, Sensors, Displays, Motion, Power, Communication, Audio, Passives; paginated, with search), center canvas where modules are placed and wired pin to pin, right part inspector (pins, voltage, current, interface, price, datasheet link). Top tabs: Build, Schematic, PCB, 3D. Wires are drawn by clicking a pin then another pin. Modules can be dragged, rotated and deleted. The build autosaves.
5. Checks: six status tiles (Power, Voltage, Pins, Addresses, Cost, Board Fit), each green, amber or red with the key number, plus the sticky notes.
6. Board: the PCB view and 3D board view (rotate, zoom), export buttons (Gerber zip, BOM CSV, KiCad files, Circuit JSON), and the manufacturing quote panel.
7. Summary: build name, parts list, totals (cost, power, estimated battery life), and a share link with a QR code.

# 5. Data (seed files in /data, typed in /lib/types.ts)

Part type: id, name, category, manufacturer, interface (I2C, SPI, UART, GPIO, analog, PWM, power), supplyVoltageMin, supplyVoltageMax, logicVoltage, currentTypical_mA, currentPeak_mA, i2cAddresses (default plus alternates), pins (name, function, type, voltage), dimensions_mm, priceUSD, datasheetUrl, footprint (for the tscircuit carrier board, a header pattern matching the module's pin spacing), verified (boolean), source (string).

Seed about 60 common maker modules. Include at least: ESP32 DevKit, ESP32-S3, Seeed XIAO ESP32-S3, Arduino Uno, Arduino Nano, Raspberry Pi Pico, Raspberry Pi Zero 2 W, BME280, DHT22, MPU6050, HC-SR04, PIR HC-SR501, LDR module, soil moisture sensor, INA219, VL53L0X, SSD1306 OLED 128x64, ST7789 TFT, LCD1602 with I2C backpack, WS2812B strip, SG90 servo, 28BYJ-48 with ULN2003, TB6612FNG, L298N, A4988, N20 gear motor, TP4056, AMS1117-3.3, MT3608, 18650 cell, LiPo 500mAh, HC-05, nRF24L01, RC522 RFID, SX1276 LoRa, MAX98357A, DFPlayer Mini, small speaker, microphone INMP441, buttons, potentiometer, buzzer, LEDs, resistors, capacitors, coin vibration motor, NPN transistor, diode.

Use datasheet values. Where you are not certain of a number, set verified: false and show a small "unverified" tag in the inspector. Never invent precise numbers silently.

Categories, in this exact order:
1. Custom (always first; opens an empty Builder, same as Start From Scratch)
2. Phones
3. Laptops
4. Tablets
5. Projectors
6. Smartwatches
7. Smart Home
8. Robots
9. Game Consoles
10. Audio
11. Cameras
12. More (Coming Soon) (always last; muted tile, opens a notice that more categories are coming)

Categories 2 to 11 each have generic architecture blocks (name, description, typical maker equivalent) for the 3D exploded view, and 2 or 3 starter templates. Required templates, at least one per category:
- Phones: Pocket LoRa Messenger (ESP32, SX1276 LoRa, small TFT, buttons, LiPo, TP4056).
- Laptops: Laptop-Style Handheld Computer (Pi Zero 2 W, TFT, keyboard matrix, battery, MT3608 boost converter).
- Tablets: Pi Touch Tablet (Pi Zero 2 W, larger TFT with touch, battery, boost converter).
- Projectors: Mini Projector Controller (ESP32, ST7789 as preview, buttons, cooling fan).
- Smartwatches: Smartwatch (ESP32-S3, small or round TFT, MPU6050, vibration motor, LiPo).
- Smart Home: Plant Monitor (ESP32, soil sensor, BME280, OLED).
- Robots: Robot Car (ESP32, TB6612FNG, 2 N20 motors, HC-SR04, 18650 pack).
- Game Consoles: Handheld Game Console (Pico or ESP32, ST7789, buttons, buzzer, LiPo, charger).
- Audio: Smart Speaker (ESP32, INMP441, MAX98357A, speaker).
- Cameras: Wi-Fi Camera (ESP32-CAM with OV2640, PIR sensor, LED, power). Add ESP32-CAM and OV2640 to the seed parts.
- Also add Gesture Ring (XIAO ESP32-S3, 4 touch pads, vibration motor with transistor and diode, LED, LiPo) as a featured template under Smartwatches and on the Templates block on Home. Plus one hidden Easter egg template for Most Impractical: "Overengineered Soda Can" (a microcontroller, a tilt sensor and a buzzer that screams when the can is opened), reachable via a small secret link on the Summary page.

# 6. Checks engine (/lib/checks, pure functions, full Vitest coverage)

- Power: sum typical and peak current per voltage rail; compare with regulator and battery limits; estimate battery life as usable mAh (capacity × 0.8) ÷ average current. Read MATLAB-generated discharge curves from /data/matlab/*.json if present, otherwise use the simple formula.
- Voltage: flag a 5V-logic part connected to a 3.3V-logic controller pin with no level shifter; flag supply voltage outside a part's range.
- Pins: count needed vs available GPIO, ADC-capable, PWM-capable pins; detect two outputs on one pin; check that shared I2C and SPI buses are wired correctly.
- Addresses: detect I2C address clashes and suggest a part's alternate address if it has one.
- Cost: BOM total from part prices, plus board and assembly estimate from the quote adapter.
- Board Fit: total footprint area vs board size, with mounting holes.
Each check returns status (ok, warn, fail), a headline number, and a list of findings with machine-readable fix suggestions.

# 7. Sticky notes

- Findings from the checks appear as small sticky notes that pop onto the canvas or schematic next to the affected part, with a soft paper look (warm yellow #F4E3A1, slight rotation, subtle shadow), a short title, one or two lines, and buttons "Apply" (performs the suggested swap or rewire) and "Dismiss".
- Wording must be grounded and neutral, for example: "Based on the checks we ran, we suggest swapping the AMS1117 for an MT3608. Your 5V rail needs 640mA, which is over this regulator's limit." Never say "AI", "assistant", "I think" or "chat", and never claim a human expert reviewed the build.
- A "Pairs well with" section in the part inspector suggests compatible parts from a rule-based compatibility map in /data. If GEMINI_API_KEY is set, use Gemini only to rank the rule-based candidates and to write the short note text; otherwise use templates.
- Notes support 3 languages (English, Spanish, Hindi) via a small i18n layer, switchable in settings.

# 8. Input and gestures

- Keyboard map (used by keyboard, the ring and gestures alike): Enter = select, Escape = back, E = explode or collapse, Space = hold for voice command, arrow keys = move between items and pages, + and − = zoom, R = rotate.
- Webcam hand tracking (toggle in the corner, off by default): index fingertip moves the copper ring cursor, pinch = select, open-palm swipe left or right = previous or next page, spread fingers = explode, fist = collapse, two-hand pinch = zoom and rotate the 3D view. Smooth and deadzone the cursor so it is not jittery.
- Voice commands with the browser Web Speech API while Space is held: "open phones", "start from scratch", "explode", "show checks", "export board".
- Haptics: if a ring is connected over USB (Web Serial, Chrome only), send a single byte to buzz when a check turns red. Make this optional and safe if unsupported.

# 9. Integrations (one adapter per service in /lib/integrations, each with a mock fallback and listed in .env.example)

- Gemini: rank part suggestions, write sticky-note text, and identify a device category from an uploaded photo ("Scan a Device" button on the Devices page).
- TinyFish: fetch live part prices and datasheet links from store pages and a PCB manufacturing quote. Mock returns stored prices.
- MongoDB Atlas: parts catalog, categories, templates and saved builds. Mock uses the JSON seed files and localStorage.
- Tiger Data (TimescaleDB / Postgres): part price history table, a "Price Trend" sparkline in the part inspector. Mock uses generated sample history clearly labeled as sample data.
- AWS: S3 for storing exported board files, plus a Lambda handler in /services/aws-checks that runs the same checks engine. Mock writes exports to local downloads.
- Maritime: the sticky-note service packaged as a small standalone service in /services/notes-service with its own Dockerfile and README, deployable to Maritime. The site calls it if NOTES_SERVICE_URL is set, otherwise runs notes in-process.
- Vultr: Dockerfile and docker-compose for the site, plus a DEPLOY.md with Vultr steps.
- GoDaddy: a section in DEPLOY.md for pointing a registered domain at the Vultr server.
- MATLAB: a /matlab folder with live scripts (battery discharge for LiPo and 18650 cells, sensor low-pass filter design for the MPU6050) that export JSON lookup tables to /data/matlab. Include a README explaining how to run them in MATLAB Online.
- Solana: a "Pay for Board Order" button using Solana Pay on devnet only, behind a feature flag, clearly labeled as a devnet demo.
- Best Gaming: in the Handheld Game Console template, a "Run" button that plays Snake on a simulated ST7789 screen in the browser (a simple canvas game driven by the template's button mapping). Gesture or keyboard controls the game.
- Accessibility features (for Diversity/Equality): one-handed operation via the ring, keyboard-only flow, high-contrast mode, reduced motion, multilingual notes.
- Future of Work: on the Summary page, a "Time and Cost Saved" panel comparing the build against typical prototyping costs, with the assumptions shown.
- Audience Vote: share link and QR code on the Summary page.
- Mascot: placeholder slot on Home and on the sticky notes, ready for the team's drawing.

# 10. Firmware (/firmware/gesture-ring)

Arduino sketch for Seeed XIAO ESP32-S3 (pins configurable at the top of the file):
- Thumb pad wired to GND, four finger pads on GPIO inputs with internal pull-ups; a pad reading LOW = pinch.
- Debounce about 30 ms.
- Acts as a Bluetooth LE keyboard (use a well-maintained BLE keyboard library, and document which one in the README): index = Enter, middle = Escape, ring = E, pinky = Space (held while pinched).
- LED on while any pinch is held.
- Vibration motor on a GPIO through an NPN transistor; buzz 150 ms when it receives byte 'B' over USB serial.
- README with wiring table, parts list, flashing steps and a testing order: pads in Serial Monitor first, then Bluetooth typing, then motor.
- Also include a Pro Micro (USB HID, wired) variant as a fallback.

# 11. Build order and acceptance criteria

Phase 1 (core): project setup, design system, Home, Devices, Category with 3D exploded view, Builder with palette, canvas, wiring and inspector, seed data, checks engine with tests, Checks page, sticky notes. Acceptance: both starting paths work end to end with mocks; all pages fit one screen at 1440×900 and 1280×800 with no scrollbars.
Phase 2: Schematic, PCB and 3D tabs via tscircuit, Board page with exports, Summary page with QR. Acceptance: the Gesture Ring template produces a schematic, a routed carrier PCB, a 3D view and downloadable Gerber and BOM files.
Phase 3: keyboard map, webcam hand tracking, voice commands, Web Serial haptics, firmware folder.
Phase 4: integration adapters with mocks for every service in section 9, MATLAB folder, services folder, Docker and DEPLOY.md, Snake game, Solana devnet flag, i18n.

After each phase: run lint, typecheck, Vitest and next build, fix everything, then run Playwright to screenshot every page at 1440×900 into /screenshots and visually confirm there is no overflow, overlap or scrollbar. Commit.

# 12. Documentation

- README.md: what it is, how to run locally with no keys, how to enable each integration, architecture diagram in Mermaid.
- DEVPOST.md: a draft submission with one section per prize track (Best Overall, Best Hardware, Future of Work by JFF Ventures, Gemini, TinyFish, MATLAB, Maritime, AWS, MongoDB Atlas, Tiger Data, Vultr, GoDaddy domain, Solana, Best Gaming, Most Impractical, Diversity/Equality, Best Mascot, Audience Vote) stating exactly what the project uses for that track and where in the code it lives. Be accurate: state plainly that Gemini ranks suggestions and writes note text. Do not claim any integration works live if it only runs as a mock; mark those as "mock until key is added".
- DECISIONS.md: every judgment call you made.
- .env.example with every key, commented.

# 13. Rules

- Never commit secrets. Keys only via environment variables.
- No copyrighted logos, product photos or brand 3D models. Device views are generic.
- Credit open-source data and libraries (tscircuit, MediaPipe, Fritzing or Adafruit or SparkFun parts if used, jlcparts) in README with licenses.
- Keep the UI free of chatbot patterns and AI wording.
- When finished, write a short STATUS.md listing what works, what is mocked, and known issues.
