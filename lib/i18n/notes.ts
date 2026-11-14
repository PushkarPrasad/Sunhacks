// Sticky-note text per finding code. Neutral and grounded: notes describe what the checks found and what we
// suggest. Placeholders: {key}. Optional segments: [?key]...[/key] are kept only when `key` has a value.

export type Lang = "en" | "es" | "hi";
type NoteText = { title: string; body: string };
type Dict = Record<string, NoteText>;

const en: Dict = {
  short_circuit: { title: "Supply shorted to ground", body: "Based on the checks we ran, {part} {pin} is wired straight to ground. That would short the supply; we suggest removing that wire." },
  rail_over_limit: { title: "{rail} rail over its limit", body: "Based on the checks we ran, your {rail} rail needs {load} mA, which is over the {limit} mA limit of {source}.[?suggestion] We suggest swapping it for the {suggestion}.[/suggestion]" },
  rail_peak_over: { title: "{rail} rail peaks too high", body: "Typical draw on the {rail} rail is {load} mA, but peaks reach {peak} mA, over the {limit} mA that {source} can supply.[?suggestion] We suggest the {suggestion}.[/suggestion] A 470 µF capacitor near the load also helps." },
  rail_near_limit: { title: "{rail} rail close to its limit", body: "The {rail} rail runs at {load} mA of {source}'s {limit} mA. That leaves little headroom for peaks.[?suggestion] We suggest the {suggestion}.[/suggestion]" },
  unpowered: { title: "{part} has no power", body: "{part} {pin} is not connected to a supply rail, so it will not turn on. We suggest connecting it to a rail in its voltage range." },
  no_ground: { title: "{part} has no ground", body: "{part} shares no ground with the rest of the build. Signals need a common ground; we suggest wiring its GND to the controller's GND." },
  dropout: { title: "Not enough headroom for {part}", body: "{part} needs about {dropout} V above its {vout} V output, but its input is {vin} V.[?suggestion] We suggest swapping it for the {suggestion}, which works from a single cell.[/suggestion]" },
  gpio_overcurrent: { title: "{part} needs a driver", body: "{part} draws about {current} mA straight from {pin}, and that pin is rated for {limit} mA. We suggest switching it with an NPN transistor and a 1 kΩ base resistor." },
  battery_no_charger: { title: "{part} has no charger", body: "Lithium cells need a charger with protection. We suggest adding a TP4056 module between the cell and the rest of the build." },
  controller_not_on_battery: { title: "{part} is not on the battery", body: "{part} has no supply connection, so it will only run while USB is plugged in. Connect it to the battery path to run untethered." },
  supply_conflict: { title: "Two supplies on one rail", body: "{a} ({va} V) and {b} ({vb} V) drive the same net. The higher one will back-feed the other; we suggest giving each its own rail." },
  overvoltage: { title: "{part} {pin} over voltage", body: "Based on the checks we ran, {part} {pin} sees up to {voltage} V, but it is rated for {max} V. We suggest moving it to a lower rail or adding a regulator." },
  undervoltage: { title: "{part} {pin} under voltage", body: "{part} {pin} gets {voltage} V and needs at least {min} V, so it may reset or misread. We suggest moving it to a higher rail." },
  logic_5v_into_3v3: { title: "5 V signal into a 3.3 V pin", body: "Based on the checks we ran, {part} {pin} drives {level} V into {controller} {ctrlPin}, which is a 3.3 V pin. We suggest adding a level shifter between them." },
  logic_5v_out_into_3v3: { title: "5 V output into a 3.3 V input", body: "{controller} {ctrlPin} drives 5 V into {part} {pin}, which expects 3.3 V. We suggest a level shifter on this line." },
  logic_5v_uart: { title: "5 V serial into a 3.3 V input", body: "{controller} {ctrlPin} sends 5 V serial into {part} {pin}. Most modules survive with a 1 kΩ series resistor; a level shifter is the clean fix." },
  logic_vih: { title: "{part} may miss 3.3 V signals", body: "{part} {pin} needs at least {vih} V for a logic high, and the controller only drives {level} V. It often works, but a level shifter makes it reliable." },
  flash_pin: { title: "{pin} is wired to the flash chip", body: "On {controller}, {pin} connects to the onboard flash. Using it will stop the board from booting; we suggest moving the wire to a free GPIO." },
  input_only: { title: "{pin} is input-only", body: "{controller} {pin} can only read, but {part} {partPin} needs a signal driven to it. We suggest moving the wire to a free output pin." },
  needs_adc: { title: "{part} needs an analog pin", body: "{part} {partPin} outputs an analog voltage, but {controller} {pin} has no ADC. We suggest moving the wire to a free ADC pin." },
  needs_pwm: { title: "{part} needs a PWM pin", body: "{part} {partPin} needs PWM, which {controller} {pin} cannot produce. We suggest moving the wire to a free PWM pin." },
  uart_tx_tx: { title: "TX wired to TX", body: "{part} {partPin} and {controller} {pin} are both transmit pins. Serial lines cross over: TX goes to RX.[?suggestion] We suggest moving the wire to {suggestion}.[/suggestion]" },
  i2c_swapped: { title: "SDA and SCL look swapped", body: "{part} {partPin} goes to {controller} {pin}, which is the other I2C line.[?suggestion] We suggest moving it to {suggestion}.[/suggestion]" },
  bus_wrong_pin: { title: "{bus} needs a hardware pin", body: "{controller} only offers {bus} on fixed pins, and {pin} is not one of them.[?suggestion] We suggest moving {part} {partPin} to {suggestion}.[/suggestion]" },
  two_outputs: { title: "Two outputs on one pin", body: "{a} and {b} both drive the same net and will fight each other. We suggest giving each its own GPIO." },
  shared_cs: { title: "Shared chip select", body: "{a} and {b} share one chip-select line, so both will answer at once. Each SPI device needs its own CS pin." },
  sda_scl_shorted: { title: "SDA tied to SCL", body: "An I2C data line is connected to a clock line. The bus will not work until they are separated." },
  unwired_required: { title: "{part} is missing wires", body: "{part} still needs {pins} connected before it can work." },
  gpio_near_full: { title: "{controller} is almost out of pins", body: "{used} of {available} usable GPIOs are taken. An I2C expander or a shift register frees pins if you plan to add more." },
  i2c_clash: { title: "I2C address clash at {address}", body: "Based on the checks we ran, {a} and {b} both answer at {address} on the same bus. We suggest moving {b} to {alt}[?how] ({how})[/how]." },
  i2c_clash_no_alt: { title: "I2C address clash at {address}", body: "{a} and {b} both answer at {address} and {b} has no alternate address. We suggest a TCA9548A multiplexer to put them on separate channels." },
  over_budget: { title: "{over} over budget", body: "The build comes to {total} against a {budget} budget. The largest costs are {top}." },
  board_too_small: { title: "Parts do not fit the board", body: "The modules need more room than {w} × {h} mm allows. We suggest resizing the carrier to {suggestW} × {suggestH} mm." },
  board_tight: { title: "Board is {util}% full", body: "Modules cover {util}% of the usable area, which makes routing hard. We suggest growing the board to {suggestW} × {suggestH} mm." },
};

const es: Dict = {
  short_circuit: { title: "Alimentación en corto a tierra", body: "Según las comprobaciones, {part} {pin} está conectado directamente a tierra. Eso pondría la fuente en corto; sugerimos quitar ese cable." },
  rail_over_limit: { title: "Línea de {rail} por encima del límite", body: "Según las comprobaciones, la línea de {rail} necesita {load} mA, más que el límite de {limit} mA de {source}.[?suggestion] Sugerimos cambiarlo por {suggestion}.[/suggestion]" },
  rail_peak_over: { title: "Picos altos en la línea de {rail}", body: "El consumo típico en {rail} es {load} mA, pero los picos llegan a {peak} mA, por encima de los {limit} mA que da {source}.[?suggestion] Sugerimos {suggestion}.[/suggestion] Un condensador de 470 µF cerca de la carga también ayuda." },
  rail_near_limit: { title: "Línea de {rail} cerca del límite", body: "La línea de {rail} usa {load} mA de los {limit} mA de {source}. Queda poco margen para los picos.[?suggestion] Sugerimos {suggestion}.[/suggestion]" },
  unpowered: { title: "{part} no tiene alimentación", body: "{part} {pin} no está conectado a ninguna línea de alimentación, así que no encenderá. Sugerimos conectarlo a una línea dentro de su rango de voltaje." },
  no_ground: { title: "{part} no tiene tierra", body: "{part} no comparte tierra con el resto del montaje. Las señales necesitan una tierra común; sugerimos unir su GND con el GND del controlador." },
  dropout: { title: "Poco margen para {part}", body: "{part} necesita unos {dropout} V por encima de su salida de {vout} V, pero su entrada es de {vin} V.[?suggestion] Sugerimos cambiarlo por {suggestion}, que funciona con una sola celda.[/suggestion]" },
  gpio_overcurrent: { title: "{part} necesita un driver", body: "{part} consume unos {current} mA directamente de {pin}, y ese pin admite {limit} mA. Sugerimos conmutarlo con un transistor NPN y una resistencia de base de 1 kΩ." },
  battery_no_charger: { title: "{part} no tiene cargador", body: "Las celdas de litio necesitan un cargador con protección. Sugerimos añadir un módulo TP4056 entre la celda y el resto del montaje." },
  controller_not_on_battery: { title: "{part} no está en la batería", body: "{part} no tiene conexión de alimentación, así que solo funcionará con USB conectado. Conéctalo a la batería para usarlo sin cable." },
  supply_conflict: { title: "Dos fuentes en una línea", body: "{a} ({va} V) y {b} ({vb} V) alimentan la misma red. La más alta alimentará a la otra en sentido inverso; sugerimos separarlas." },
  overvoltage: { title: "Sobretensión en {part} {pin}", body: "Según las comprobaciones, {part} {pin} recibe hasta {voltage} V, pero admite {max} V. Sugerimos moverlo a una línea más baja o añadir un regulador." },
  undervoltage: { title: "Tensión baja en {part} {pin}", body: "{part} {pin} recibe {voltage} V y necesita al menos {min} V, así que puede reiniciarse o leer mal. Sugerimos moverlo a una línea más alta." },
  logic_5v_into_3v3: { title: "Señal de 5 V en un pin de 3,3 V", body: "Según las comprobaciones, {part} {pin} envía {level} V a {controller} {ctrlPin}, que es un pin de 3,3 V. Sugerimos añadir un adaptador de nivel entre ellos." },
  logic_5v_out_into_3v3: { title: "Salida de 5 V en una entrada de 3,3 V", body: "{controller} {ctrlPin} envía 5 V a {part} {pin}, que espera 3,3 V. Sugerimos un adaptador de nivel en esta línea." },
  logic_5v_uart: { title: "Serie de 5 V en una entrada de 3,3 V", body: "{controller} {ctrlPin} envía datos serie de 5 V a {part} {pin}. La mayoría de módulos aguantan con una resistencia de 1 kΩ en serie; un adaptador de nivel es la solución limpia." },
  logic_vih: { title: "{part} puede no leer 3,3 V", body: "{part} {pin} necesita al menos {vih} V para un nivel alto y el controlador solo da {level} V. Suele funcionar, pero un adaptador de nivel lo hace fiable." },
  flash_pin: { title: "{pin} está conectado a la flash", body: "En {controller}, {pin} va a la memoria flash. Usarlo impedirá que la placa arranque; sugerimos mover el cable a un GPIO libre." },
  input_only: { title: "{pin} es solo de entrada", body: "{controller} {pin} solo puede leer, pero {part} {partPin} necesita que se le envíe una señal. Sugerimos mover el cable a un pin de salida libre." },
  needs_adc: { title: "{part} necesita un pin analógico", body: "{part} {partPin} da una tensión analógica, pero {controller} {pin} no tiene ADC. Sugerimos mover el cable a un pin ADC libre." },
  needs_pwm: { title: "{part} necesita un pin PWM", body: "{part} {partPin} necesita PWM y {controller} {pin} no puede generarlo. Sugerimos mover el cable a un pin PWM libre." },
  uart_tx_tx: { title: "TX conectado a TX", body: "{part} {partPin} y {controller} {pin} son ambos de transmisión. Las líneas serie se cruzan: TX va a RX.[?suggestion] Sugerimos mover el cable a {suggestion}.[/suggestion]" },
  i2c_swapped: { title: "SDA y SCL parecen invertidos", body: "{part} {partPin} va a {controller} {pin}, que es la otra línea I2C.[?suggestion] Sugerimos moverlo a {suggestion}.[/suggestion]" },
  bus_wrong_pin: { title: "{bus} necesita un pin de hardware", body: "{controller} solo ofrece {bus} en pines fijos y {pin} no es uno de ellos.[?suggestion] Sugerimos mover {part} {partPin} a {suggestion}.[/suggestion]" },
  two_outputs: { title: "Dos salidas en un pin", body: "{a} y {b} controlan la misma red y chocarán entre sí. Sugerimos darle a cada uno su propio GPIO." },
  shared_cs: { title: "Chip select compartido", body: "{a} y {b} comparten una línea CS, así que responderán a la vez. Cada dispositivo SPI necesita su propio pin CS." },
  sda_scl_shorted: { title: "SDA unido a SCL", body: "Una línea de datos I2C está conectada a una de reloj. El bus no funcionará hasta separarlas." },
  unwired_required: { title: "A {part} le faltan cables", body: "{part} todavía necesita conectar {pins} para funcionar." },
  gpio_near_full: { title: "{controller} casi sin pines", body: "Hay {used} de {available} GPIO usados. Un expansor I2C o un registro de desplazamiento libera pines si vas a añadir más." },
  i2c_clash: { title: "Conflicto de dirección I2C en {address}", body: "Según las comprobaciones, {a} y {b} responden en {address} en el mismo bus. Sugerimos mover {b} a {alt}[?how] ({how})[/how]." },
  i2c_clash_no_alt: { title: "Conflicto de dirección I2C en {address}", body: "{a} y {b} responden en {address} y {b} no tiene dirección alternativa. Sugerimos un multiplexor TCA9548A para separarlos en canales." },
  over_budget: { title: "{over} por encima del presupuesto", body: "El montaje cuesta {total} frente a un presupuesto de {budget}. Los mayores costes son {top}." },
  board_too_small: { title: "Las piezas no caben en la placa", body: "Los módulos necesitan más espacio del que permiten {w} × {h} mm. Sugerimos cambiar la placa a {suggestW} × {suggestH} mm." },
  board_tight: { title: "Placa al {util}%", body: "Los módulos ocupan el {util}% del área útil, lo que complica el trazado. Sugerimos ampliar la placa a {suggestW} × {suggestH} mm." },
};

const hi: Dict = {
  short_circuit: { title: "सप्लाई ग्राउंड से शॉर्ट है", body: "हमारी जाँच के अनुसार {part} {pin} सीधे ग्राउंड से जुड़ा है। इससे सप्लाई शॉर्ट होगी; हमारा सुझाव है कि यह तार हटा दें।" },
  rail_over_limit: { title: "{rail} रेल सीमा से ऊपर", body: "हमारी जाँच के अनुसार आपकी {rail} रेल को {load} mA चाहिए, जो {source} की {limit} mA सीमा से ज़्यादा है।[?suggestion] हमारा सुझाव है कि इसे {suggestion} से बदलें।[/suggestion]" },
  rail_peak_over: { title: "{rail} रेल पर ऊँचे पीक", body: "{rail} रेल पर सामान्य खपत {load} mA है, पर पीक {peak} mA तक जाते हैं, जो {source} की {limit} mA क्षमता से ज़्यादा है।[?suggestion] हमारा सुझाव है {suggestion}।[/suggestion] लोड के पास 470 µF कैपेसिटर भी मदद करता है।" },
  rail_near_limit: { title: "{rail} रेल सीमा के क़रीब", body: "{rail} रेल {source} के {limit} mA में से {load} mA ले रही है। पीक के लिए बहुत कम गुंजाइश बचती है।[?suggestion] हमारा सुझाव है {suggestion}।[/suggestion]" },
  unpowered: { title: "{part} को पावर नहीं मिल रही", body: "{part} {pin} किसी सप्लाई रेल से नहीं जुड़ा है, इसलिए यह चालू नहीं होगा। इसे इसकी वोल्टेज रेंज वाली रेल से जोड़ें।" },
  no_ground: { title: "{part} का ग्राउंड नहीं है", body: "{part} बाकी सर्किट के साथ ग्राउंड साझा नहीं करता। सिग्नल के लिए साझा ग्राउंड ज़रूरी है; इसका GND कंट्रोलर के GND से जोड़ें।" },
  dropout: { title: "{part} के लिए पर्याप्त हेडरूम नहीं", body: "{part} को अपने {vout} V आउटपुट से लगभग {dropout} V ज़्यादा इनपुट चाहिए, पर इनपुट {vin} V है।[?suggestion] हमारा सुझाव है {suggestion}, जो एक सेल से चल जाता है।[/suggestion]" },
  gpio_overcurrent: { title: "{part} को ड्राइवर चाहिए", body: "{part} सीधे {pin} से लगभग {current} mA लेता है, जबकि यह पिन {limit} mA के लिए है। NPN ट्रांज़िस्टर और 1 kΩ बेस रेज़िस्टर से इसे स्विच करें।" },
  battery_no_charger: { title: "{part} का चार्जर नहीं है", body: "लिथियम सेल को सुरक्षा वाला चार्जर चाहिए। सेल और बाकी सर्किट के बीच TP4056 मॉड्यूल जोड़ें।" },
  controller_not_on_battery: { title: "{part} बैटरी से नहीं जुड़ा", body: "{part} किसी सप्लाई से नहीं जुड़ा, इसलिए यह सिर्फ़ USB लगे होने पर चलेगा। बिना तार के चलाने के लिए इसे बैटरी से जोड़ें।" },
  supply_conflict: { title: "एक रेल पर दो सप्लाई", body: "{a} ({va} V) और {b} ({vb} V) एक ही नेट को चला रहे हैं। ऊँची वोल्टेज दूसरी में उल्टा करंट भेजेगी; दोनों को अलग रेल दें।" },
  overvoltage: { title: "{part} {pin} पर ज़्यादा वोल्टेज", body: "हमारी जाँच के अनुसार {part} {pin} को {voltage} V तक मिलता है, जबकि इसकी सीमा {max} V है। इसे निचली रेल पर ले जाएँ या रेगुलेटर जोड़ें।" },
  undervoltage: { title: "{part} {pin} पर कम वोल्टेज", body: "{part} {pin} को {voltage} V मिलता है और कम से कम {min} V चाहिए, इसलिए यह रीसेट हो सकता है। इसे ऊँची रेल पर ले जाएँ।" },
  logic_5v_into_3v3: { title: "3.3 V पिन में 5 V सिग्नल", body: "हमारी जाँच के अनुसार {part} {pin} {controller} {ctrlPin} में {level} V भेजता है, जो 3.3 V पिन है। दोनों के बीच लेवल शिफ़्टर लगाएँ।" },
  logic_5v_out_into_3v3: { title: "3.3 V इनपुट में 5 V आउटपुट", body: "{controller} {ctrlPin} {part} {pin} में 5 V भेजता है, जबकि उसे 3.3 V चाहिए। इस लाइन पर लेवल शिफ़्टर लगाएँ।" },
  logic_5v_uart: { title: "3.3 V इनपुट में 5 V सीरियल", body: "{controller} {ctrlPin} {part} {pin} में 5 V सीरियल भेजता है। ज़्यादातर मॉड्यूल 1 kΩ सीरीज़ रेज़िस्टर के साथ चल जाते हैं; लेवल शिफ़्टर बेहतर हल है।" },
  logic_vih: { title: "{part} 3.3 V सिग्नल चूक सकता है", body: "{part} {pin} को हाई के लिए कम से कम {vih} V चाहिए और कंट्रोलर सिर्फ़ {level} V देता है। अक्सर चलता है, पर लेवल शिफ़्टर से भरोसेमंद होगा।" },
  flash_pin: { title: "{pin} फ़्लैश चिप से जुड़ा है", body: "{controller} पर {pin} ऑनबोर्ड फ़्लैश से जुड़ा है। इसका इस्तेमाल करने से बोर्ड बूट नहीं होगा; तार को किसी खाली GPIO पर ले जाएँ।" },
  input_only: { title: "{pin} सिर्फ़ इनपुट है", body: "{controller} {pin} सिर्फ़ पढ़ सकता है, पर {part} {partPin} को सिग्नल भेजना ज़रूरी है। तार को किसी खाली आउटपुट पिन पर ले जाएँ।" },
  needs_adc: { title: "{part} को एनालॉग पिन चाहिए", body: "{part} {partPin} एनालॉग वोल्टेज देता है, पर {controller} {pin} में ADC नहीं है। तार को किसी खाली ADC पिन पर ले जाएँ।" },
  needs_pwm: { title: "{part} को PWM पिन चाहिए", body: "{part} {partPin} को PWM चाहिए, जो {controller} {pin} नहीं दे सकता। तार को किसी खाली PWM पिन पर ले जाएँ।" },
  uart_tx_tx: { title: "TX से TX जुड़ा है", body: "{part} {partPin} और {controller} {pin} दोनों ट्रांसमिट पिन हैं। सीरियल में TX को RX से जोड़ते हैं।[?suggestion] तार को {suggestion} पर ले जाएँ।[/suggestion]" },
  i2c_swapped: { title: "SDA और SCL उल्टे लगते हैं", body: "{part} {partPin} {controller} {pin} पर जाता है, जो दूसरी I2C लाइन है।[?suggestion] इसे {suggestion} पर ले जाएँ।[/suggestion]" },
  bus_wrong_pin: { title: "{bus} को हार्डवेयर पिन चाहिए", body: "{controller} पर {bus} सिर्फ़ तय पिनों पर मिलता है और {pin} उनमें नहीं है।[?suggestion] {part} {partPin} को {suggestion} पर ले जाएँ।[/suggestion]" },
  two_outputs: { title: "एक पिन पर दो आउटपुट", body: "{a} और {b} एक ही नेट को चला रहे हैं और आपस में टकराएँगे। हर एक को अलग GPIO दें।" },
  shared_cs: { title: "साझा चिप सिलेक्ट", body: "{a} और {b} एक ही CS लाइन साझा करते हैं, इसलिए दोनों एक साथ जवाब देंगे। हर SPI डिवाइस को अपना CS पिन चाहिए।" },
  sda_scl_shorted: { title: "SDA, SCL से जुड़ा है", body: "एक I2C डेटा लाइन क्लॉक लाइन से जुड़ी है। इन्हें अलग किए बिना बस काम नहीं करेगी।" },
  unwired_required: { title: "{part} के तार अधूरे हैं", body: "काम करने के लिए {part} के {pins} अभी जोड़ने बाकी हैं।" },
  gpio_near_full: { title: "{controller} के पिन लगभग ख़त्म", body: "{available} में से {used} GPIO इस्तेमाल हो चुके हैं। और जोड़ने हों तो I2C एक्सपैंडर या शिफ़्ट रजिस्टर से पिन बचाएँ।" },
  i2c_clash: { title: "{address} पर I2C एड्रेस टकराव", body: "हमारी जाँच के अनुसार {a} और {b} दोनों एक ही बस पर {address} पर जवाब देते हैं। {b} को {alt} पर ले जाएँ[?how] ({how})[/how]।" },
  i2c_clash_no_alt: { title: "{address} पर I2C एड्रेस टकराव", body: "{a} और {b} दोनों {address} पर हैं और {b} का कोई दूसरा एड्रेस नहीं है। इन्हें अलग चैनल पर रखने के लिए TCA9548A मल्टीप्लेक्सर लगाएँ।" },
  over_budget: { title: "बजट से {over} ज़्यादा", body: "बिल्ड की कुल लागत {total} है, जबकि बजट {budget} है। सबसे बड़े ख़र्च हैं {top}।" },
  board_too_small: { title: "पार्ट्स बोर्ड में नहीं समाते", body: "मॉड्यूल्स को {w} × {h} mm से ज़्यादा जगह चाहिए। कैरियर बोर्ड को {suggestW} × {suggestH} mm करें।" },
  board_tight: { title: "बोर्ड {util}% भरा है", body: "मॉड्यूल उपयोगी जगह का {util}% घेरते हैं, जिससे रूटिंग मुश्किल होगी। बोर्ड को {suggestW} × {suggestH} mm करें।" },
};

export const noteDictionaries: Record<Lang, Dict> = { en, es, hi };

export function interpolate(template: string, params: Record<string, string | number>): string {
  const withOptional = template.replace(/\[\?(\w+)\]([\s\S]*?)\[\/\1\]/g, (_, key: string, inner: string) =>
    params[key] !== undefined && params[key] !== "" ? inner : "",
  );
  return withOptional.replace(/\{(\w+)\}/g, (_, key: string) => (params[key] !== undefined ? String(params[key]) : `{${key}}`));
}

export function noteText(code: string, params: Record<string, string | number>, lang: Lang = "en"): NoteText {
  const dict = noteDictionaries[lang] ?? en;
  const t = dict[code] ?? en[code] ?? { title: code, body: "" };
  return { title: interpolate(t.title, params), body: interpolate(t.body, params) };
}
