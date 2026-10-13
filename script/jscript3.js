// =====================================================================
//  ОБЩИЕ НАСТРОЙКИ
// =====================================================================
Tone.Transport.bpm.value = 140;

const TICKS_PER_BAR = Tone.Transport.PPQ * 4; // 4/4

// Превращает список {note, dur} / {isRest, dur} в зацикленный Tone.Part.
// Время считается в тиках транспорта, а не в секундах, поэтому ритм
// не плывёт и не зависит от погрешностей округления.
function buildLoop(name, synth, steps) {
    const events = [];
    let ticks = 0;

    steps.forEach(step => {
        const d = Tone.Time(step.dur).toTicks();
        if (!step.isRest) {
            events.push({ time: ticks + 'i', note: step.note, dur: d + 'i' });
        }
        ticks += d;
    });

    const part = new Tone.Part((time, ev) => {
        synth.triggerAttackRelease(ev.note, ev.dur, time);
    }, events);

    part.loop = true;
    part.loopEnd = ticks + 'i';

    const bars = ticks / TICKS_PER_BAR;
    if (!Number.isInteger(bars)) {
        console.warn(`⚠️ ${name}: длина ${bars.toFixed(3)} такта — не целое число, мелодии разъедутся`);
    } else {
        console.log(`🔁 ${name}: ${bars} такт(а)`);
    }
    return part;
}

// =====================================================================
//  HAPPINESS
// =====================================================================
const happinessSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.1, decay: 0.1, sustain: 0.8, release: 1.0 }
});

const distEffect = new Tone.Distortion({ wet: 0, distortion: 1 });
const chorusEffect = new Tone.Phaser({ wet: 0, frequency: 0.5 });
const happinessDelay = new Tone.PingPongDelay({ delayTime: 0.15, wet: 0 });
const freeVerb = new Tone.Freeverb({ wet: 0, roomSize: 0.7 });

// Synth → Distortion → Phaser → Delay → Reverb → Выход
happinessSynth.chain(distEffect, chorusEffect, happinessDelay, freeVerb, Tone.Destination);

// Ровно 3 такта. Ритм «3+3+2»: каждая группа — ровно полтакта,
// первая нота группы всегда на сильной доле
const happinessNotes = [
    // такт 1
    { note: "F4", dur: "8n." }, { note: "C5", dur: "8n." }, { note: "A4", dur: "8n" },
    { note: "F4", dur: "8n." }, { note: "C5", dur: "8n." }, { note: "A4", dur: "8n" },
    // такт 2
    { note: "F4", dur: "8n." }, { note: "G4", dur: "8n." }, { note: "A4", dur: "8n" },
    { note: "A4", dur: "2n" },
    // такт 3 — пауза, здесь отвечает inspiration
    { isRest: true, dur: "1n" },
];

const happinessPart = buildLoop('happiness', happinessSynth, happinessNotes);

// =====================================================================
//  CALMNESS
// =====================================================================
const calmSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.03, decay: 0.2, sustain: 0.7, release: 0.8 },
    volume: -Infinity // ручка сверху: тишина
});

const calmReverb = new Tone.Freeverb({ roomSize: 0.7, dampening: 2500, wet: 0.25 });
calmSynth.chain(calmReverb, Tone.Destination);

// Опора снизу: одна длинная нота на такт, октавой ниже мелодии. 3 такта.
// C в третьем такте создаёт ожидание и тянет обратно к началу петли.
const calmNotes = [
    { note: "F3", dur: "1n" },
    { note: "A3", dur: "1n" },
    { note: "C4", dur: "1n" },
];

const calmPart = buildLoop('calmness', calmSynth, calmNotes);

// =====================================================================
//  INSPIRATION
// =====================================================================
const inspoSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 2.55, sustain: 0, release: 1 },
    volume: -Infinity
});
inspoSynth.detune.value = 4;

const bellFilter = new Tone.Filter({ type: 'highpass', frequency: 600, Q: 1 });
const inspoReverb = new Tone.Freeverb({ wet: 0.8, roomSize: 0.6 });

// Synth → Filter → Reverb → Выход
inspoSynth.chain(bellFilter, inspoReverb, Tone.Destination);

// Ровно 3 такта. Отвечает только в паузах мелодии — диалог «вопрос — ответ»
const inspoNotes = [
    // такт 1 — молчит, мелодия занята
    { isRest: true, dur: "1n" },
    // такт 2 — вступает, пока happiness тянет A
    { isRest: true, dur: "2n" },
    { isRest: true, dur: "8n" },
    { note: "C6", dur: "8n" }, { note: "A5", dur: "8n" }, { note: "F5", dur: "8n" },
    // такт 3 — полный ответ, заканчивается «домой» на F
    { note: "A5", dur: "8n" }, { note: "C6", dur: "8n" },
    { note: "A5", dur: "8n" }, { note: "G5", dur: "8n" },
    { note: "F5", dur: "2n" },
];

const inspoPart = buildLoop('inspiration', inspoSynth, inspoNotes);

// Все петли привязаны к нулю транспорта и всегда начинаются вместе
happinessPart.start(0);
calmPart.start(0);
inspoPart.start(0);

// =====================================================================
//  ИНТЕРФЕЙС
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {

    // --- Mute ---
    const muteBtn = document.getElementById('mutecontroller');
    if (muteBtn) {
        let isMuted = false;
        muteBtn.addEventListener('click', async () => {
            await Tone.start();
            isMuted = !isMuted;
            Tone.Destination.mute = isMuted;          // транспорт продолжает идти
            muteBtn.classList.toggle('muted', isMuted);
        });
    }

    // --- Кнопки формы волны ---
    const container = document.querySelector('.wave-buttons');
    if (container) {
        const buttons = container.querySelectorAll('.wave-btn');

        function updateActiveState() {
            const activeBtn = container.querySelector('.wave-btn.active');
            if (!activeBtn) return;
            const rect = activeBtn.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const left = rect.left - containerRect.left;
            const width = rect.width + 16;
            container.style.setProperty('--btn-left', (left - 8) + 'px');
            container.style.setProperty('--btn-width', width + 'px');
        }

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                happinessSynth.oscillator.type = btn.dataset.type;
                updateActiveState();
            });
        });

        updateActiveState();
    }

    // --- Переключатель эмоций ---
    const emotionBox = document.querySelector('.emotion-buttons');
    if (emotionBox) {
        const emotionBtns = emotionBox.querySelectorAll('.emotion-btn');

        function moveEmotionHighlight() {
            const active = emotionBox.querySelector('.emotion-btn.active');
            if (!active) {
                emotionBox.style.setProperty('--btn-left', '0px');
                emotionBox.style.setProperty('--btn-width', '0px');
                return;
            }

            const rect = active.getBoundingClientRect();
            const containerRect = emotionBox.getBoundingClientRect();

            const left = rect.left - containerRect.left - 8;
            const width = rect.width + 16;

            emotionBox.style.setProperty('--btn-left', left + 'px');
            emotionBox.style.setProperty('--btn-width', width + 'px');
        }

        emotionBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const emotion = btn.dataset.emotion;

                if (emotion === 'happiness') {
                    await Tone.start();
                    if (Tone.Transport.state !== 'started') {
                        Tone.Transport.position = 0;
                        Tone.Transport.start('+0.1');
                    }
                }

                emotionBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.body.dataset.emotion = emotion;

                moveEmotionHighlight();
            });
        });

        window.addEventListener('resize', moveEmotionHighlight);
        moveEmotionHighlight(); // Запускаем расчёт
    } else {
        console.error('❌ Блок .emotion-buttons не найден!');
    }


    // --- Горизонтальные слайдеры (общая функция вместо пяти копий) ---
    function initSlider(containerSel, thumbSel, onChange) {
        const box = document.querySelector(containerSel);
        if (!box) { console.warn(`Элемент ${containerSel} не найден`); return; }
        const thumb = box.querySelector(thumbSel);
        if (!thumb) { console.error(`Элемент ${thumbSel} не найден внутри ${containerSel}`); return; }

        let dragging = false, startX = 0, startLeft = 0;

        thumb.addEventListener('mousedown', (e) => {
            dragging = true;
            startX = e.clientX;
            startLeft = thumb.getBoundingClientRect().left - box.getBoundingClientRect().left;
        });

        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const maxLeft = box.offsetWidth - thumb.offsetWidth;
            const newLeft = Math.max(0, Math.min(startLeft + e.clientX - startX, maxLeft));
            thumb.style.left = newLeft + 'px';
            onChange(maxLeft > 0 ? newLeft / maxLeft : 0);
        });

        document.addEventListener('mouseup', () => { dragging = false; });
    }

    initSlider('.freeverbcont', '.slider-thumb', p => { freeVerb.wet.value = p; });

    initSlider('.delaycont', '.slider-thumb1', p => {
        happinessDelay.delayTime.value = 0.05 + p * 0.35;
        happinessDelay.wet.value = p;
    });

    initSlider('.choruscont', '.slider-thumb2', p => { chorusEffect.wet.value = p; });

    initSlider('.distortioncont', '.slider-thumb3', p => { distEffect.wet.value = p; });

    initSlider('.attackcont', '.slider-thumba', p => {
        happinessSynth.envelope.attack = 0.005 + p * 1.0;
    });
    initSlider('.decaycont', '.slider-thumbd', p => {
        freeVerb.roomSize.value = 0.3 + p * 0.65; // у Freeverb нет decay, есть roomSize
    });
    initSlider('.sustaincont', '.slider-thumbs', p => {
        happinessSynth.envelope.sustain = p;
    });
    initSlider('.releasecont', '.slider-thumbr', p => {
        happinessSynth.envelope.release = 0.05 + p * 3;
    });

    // --- Крутилки громкости (только громкость, без запуска) ---

    // happiness: 0° — 100%, 270° — тишина
    initMarkKnob('.mark4', '.volumecont', (v) => {
        happinessSynth.volume.value = v <= 0.001 ? -Infinity : Tone.gainToDb(v);
    });

    // calmness: 0° — тишина, 270° — максимум
    initMarkKnob('.calmnesscont .mark', '.calmnesscont', (v) => {
        const level = 1 - v;
        calmSynth.volume.value = level <= 0.001 ? -Infinity : Tone.gainToDb(level);
    });

    // inspiration: 0° — тишина, 270° — максимум
    initMarkKnob('.inspirationcont .mark2', '.inspirationcont', (v) => {
        const level = 1 - v;
        inspoSynth.volume.value = level <= 0.001 ? -Infinity : Tone.gainToDb(level);
    });
});

// =====================================================================
//  КРУТИЛКА
// =====================================================================
function initMarkKnob(markSelector, containerSelector, onValueChange) {
    const mark = document.querySelector(markSelector);
    const container = document.querySelector(containerSelector);

    if (!mark || !container) {
        console.error('❌ Элементы не найдены:', markSelector, containerSelector);
        return;
    }

    let isDragging = false;
    let radius = 0;
    let centerX = 0;
    let centerY = 0;
    let lastDeg = 0; // своё значение у каждой крутилки

    function updateGeometry() {
        const cRect = container.getBoundingClientRect();
        const mRect = mark.getBoundingClientRect();

        centerX = cRect.left + cRect.width / 2;
        centerY = cRect.top + cRect.height / 2;

        const baseRadius = (cRect.width / 2) - (mRect.height / 2);
        radius = baseRadius * 0.65;

        if (!isDragging) {
            const a = lastDeg * Math.PI / 180;
            const x = radius * Math.sin(a);
            const y = -radius * Math.cos(a);
            mark.style.transform =
                'translate(-50%, -50%) translate(' + x + 'px, ' + y + 'px) rotate(' + lastDeg + 'deg)';
        }
    }

    updateGeometry();
    window.addEventListener('resize', updateGeometry);

    function getAngleDeg(e) {
        let angleRad = Math.atan2(e.clientY - centerY, e.clientX - centerX) + Math.PI / 2;
        while (angleRad < 0) angleRad += Math.PI * 2;
        while (angleRad >= Math.PI * 2) angleRad -= Math.PI * 2;
        return angleRad * (180 / Math.PI); // 0..360, 0 — верх, по часовой
    }

    container.addEventListener('mousedown', (e) => {
        if (e.target === mark || mark.contains(e.target)) {
            isDragging = true;
            e.preventDefault();
            updateGeometry();
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        let angleDeg = getAngleDeg(e);

        // Мёртвая зона 270..360: прижимаем к ближайшему краю
        if (angleDeg > 270) {
            angleDeg = lastDeg > 135 ? 270 : 0;
        }
        lastDeg = angleDeg;

        const a = angleDeg * Math.PI / 180;
        const x = radius * Math.sin(a);
        const y = -radius * Math.cos(a);

        mark.style.transform =
            'translate(-50%, -50%) translate(' + x + 'px, ' + y + 'px) rotate(' + angleDeg + 'deg)';

        // 0° → 1, 270° → 0
        if (typeof onValueChange === 'function') {
            onValueChange(1 - angleDeg / 270);
        }
    });
}
