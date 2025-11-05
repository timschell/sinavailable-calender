<script>
	import { getContext } from 'svelte';
	import '@fullcalendar/core/locales-all';
	import FullCalendar from 'svelte-fullcalendar';
	import daygridPlugin from '@fullcalendar/daygrid';
	import timeGridPlugin from '@fullcalendar/timegrid';
	import listPlugin from '@fullcalendar/list';
	import { onMount } from 'svelte';
	import { langs, codeLang } from './lang';

	// --- Budibase Inputs ---
	export let language;
	export let calendarEvent;

	export let mappingTitle;
	export let mappingDate;
	export let mappingStart;
	export let mappingEnd;

	export let mappingTitle2;
	export let mappingDate2;
	export let mappingStart2;
	export let mappingEnd2;

	export let dataProvider;
	export let dataProvider2;

	export let mappingColor;
	export let mappingColor2;

	export let allday;
	export let allday2;

	export let headerOptionsStart;
	export let headerOptionsCenter;
	export let headerOptionsEnd;

	// Ansicht: "counts" (aggregiert) oder "events" (Einzeltermine)
	export let viewMode = 'counts';

	// --- Farb-/Schwellen-Logik (Sidebar) ---
	export let thresholdMin = 1;
	export let thresholdMax = 5;

	export let colorMin = 'rgba(76,175,80,0.25)';
	export let colorNeutral = 'rgba(255,235,59,0.35)';
	export let colorMax = 'rgba(244,67,54,0.35)';

	// Anzeige-Templates
	export let displayTemplate = ''; // optional – überschreibt Singular/Plural wenn gesetzt
	export let displayTemplateSingular = 'Es ist {count} SINA-Gerät verfügbar';
	export let displayTemplatePlural = 'Es sind {count} SINA-Geräte verfügbar';

	// --- Interner State ---
	let eventsList = [];
	let eventsByDate = {};
	let countsByDate = {};

	const toISODate = (val) => {
		if (!val) return null;
		const d = new Date(val);
		if (isNaN(d)) return null;
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	};

	const addEventToBuckets = (ev) => {
		const key = toISODate(ev.start || ev.date);
		if (!key) return;
		if (!eventsByDate[key]) eventsByDate[key] = [];
		eventsByDate[key].push(ev);
		countsByDate[key] = (countsByDate[key] || 0) + 1;
	};

	const buildEvents = () => {
		eventsList = [];
		eventsByDate = {};
		countsByDate = {};

		if (dataProvider?.rows) {
			dataProvider.rows.forEach((row) => {
				const ev = {
					title: row?.[mappingTitle],
					date: row?.[mappingDate],
					start: row?.[mappingStart],
					end: row?.[mappingEnd],
					color: mappingColor ?? '#313131',
					event: row,
					allDay: allday,
				};
				eventsList.push(ev);
				addEventToBuckets(ev);
			});
		}

		if (dataProvider2?.rows) {
			dataProvider2.rows.forEach((row) => {
				const ev = {
					title: row?.[mappingTitle2],
					date: row?.[mappingDate2],
					start: row?.[mappingStart2],
					end: row?.[mappingEnd2],
					color: mappingColor2 ?? '#eb4034',
					event: row,
					allDay: allday2,
				};
				eventsList.push(ev);
				addEventToBuckets(ev);
			});
		}
	};

	onMount(buildEvents);

	// Rebuild bei Daten-/Konfig-Änderungen
	$: JSON.stringify({
		a: dataProvider?.rows,
		b: dataProvider2?.rows,
		m1: {
			mappingTitle,
			mappingDate,
			mappingStart,
			mappingEnd,
			allday,
			mappingColor,
		},
		m2: {
			mappingTitle2,
			mappingDate2,
			mappingStart2,
			mappingEnd2,
			allday2,
			mappingColor2,
		},
		th: { thresholdMin, thresholdMax },
		col: { colorMin, colorNeutral, colorMax },
		dt: { displayTemplate, displayTemplateSingular, displayTemplatePlural },
	}),
		buildEvents();

	const isAggregate = () => viewMode === 'counts';

	const baseOptions = {
		plugins: [daygridPlugin, listPlugin, timeGridPlugin],
		initialDate: new Date(),
		locale: language,
		dayMaxEvents: true,
		firstDay: 1,
		theme: true,
		...langs[codeLang(language)],
	};

	const makeCustomButtons = () => ({
		toggleView: {
			text: isAggregate() ? 'Events' : 'Anzahl',
			click: () => {
				viewMode = isAggregate() ? 'events' : 'counts';
			},
		},
	});

	const ensureEndToolbar = () => {
		const end = (headerOptionsEnd ?? '').trim();
		return end.length > 0
			? `${end},toggleView`
			: 'dayGridMonth,dayGridWeek,timeGridDay,toggleView';
	};

	const colorForCount = (count) => {
		if (count >= thresholdMax) return colorMax;
		if (count <= thresholdMin) return colorMin;
		if (count > thresholdMin && count < thresholdMax) return colorNeutral;
		return '';
	};

	// robuster "Heute"-Vergleich in LOKALZEIT (kein ISO/UTC-Geraffel)
	const startOfLocalDay = (d) =>
		new Date(d.getFullYear(), d.getMonth(), d.getDate());
	const isTodayLocal = (d) =>
		startOfLocalDay(d).getTime() === startOfLocalDay(new Date()).getTime();

	const formatDisplay = (dateObj, count) => {
		const iso = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
		const weekday = dateObj.toLocaleDateString(language || 'de', {
			weekday: 'short',
		});
		const dateHuman = dateObj.toLocaleDateString(language || 'de', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		});

		let template =
			displayTemplate && displayTemplate.trim().length > 0
				? displayTemplate
				: count === 1
					? displayTemplateSingular
					: displayTemplatePlural;

		return template
			.replaceAll('{count}', String(count))
			.replaceAll('{iso}', iso)
			.replaceAll('{weekday}', weekday)
			.replaceAll('{date}', dateHuman);
	};

	// Klick direkt an die Zelle hängen (ohne interactionPlugin)
	const dayCellDidMountAgg = (arg) => {
		const key = `${arg.date.getFullYear()}-${String(arg.date.getMonth() + 1).padStart(2, '0')}-${String(arg.date.getDate()).padStart(2, '0')}`;
		const count = countsByDate[key] || 0;
		const bg = colorForCount(count);

		// Hintergrund
		if (bg) {
			arg.el.style.background = bg;
			arg.el.style.borderRadius = '6px';
		} else {
			arg.el.style.background = '';
		}

		// Heute hervorheben (sichtbar, unabhängig vom Theme)
		if (isTodayLocal(arg.date)) {
			arg.el.classList.add('bbfc-today');
			// zusätzlich sichtbarer Inset-Ring
			arg.el.style.boxShadow = 'inset 0 0 0 3px rgba(0,0,0,0.45)';
		} else {
			arg.el.classList.remove('bbfc-today');
			arg.el.style.boxShadow = '';
		}

		// Klickbarkeit + A11y
		arg.el.style.cursor = 'pointer';
		arg.el.setAttribute('role', 'button');
		arg.el.setAttribute('tabindex', '0');
		arg.el.title = count > 0 ? formatDisplay(arg.date, count) : '';

		const fire = () => {
			const events = eventsByDate[key] || [];
			const payload = {
				date: key,
				count: events.length,
				events,
				label: formatDisplay(new Date(key), events.length),
				isToday: isTodayLocal(new Date(key)),
			};
			calendarEvent({ value: payload });
		};
		arg.el.addEventListener('click', fire);
		arg.el.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				fire();
			}
		});

		arg.el.classList.toggle('bbfc-colored', !!bg);
	};

	// Inhalt der Zelle (Tageszahl + Satz + "Heute"-Badge)
	const dayCellContentAgg = (arg) => {
		const key = `${arg.date.getFullYear()}-${String(arg.date.getMonth() + 1).padStart(2, '0')}-${String(arg.date.getDate()).padStart(2, '0')}`;
		const count = countsByDate[key] || 0;
		const dayNum = arg.dayNumberText || '';
		const label = count > 0 ? formatDisplay(arg.date, count) : '';
		const todayBadge = isTodayLocal(arg.date)
			? '<span class="bbfc-badge">Heute</span>'
			: '';
		return {
			html: `
        <div class="bbfc-wrap">
          <div class="bbfc-daynum">${dayNum}${todayBadge}</div>
          <div class="bbfc-center">
            ${label ? `<span class="bbfc-label">${label}</span>` : ''}
          </div>
        </div>
      `,
		};
	};

	// Events-Ansicht: Klick auf Event
	const onEventClick = (event) => {
		const rowId = event?.event?.extendedProps?.event?._id || '';
		calendarEvent({ value: event.event, rowId });
	};

	let options;
	$: options = {
		...baseOptions,
		headerToolbar: {
			start: headerOptionsStart,
			center: headerOptionsCenter,
			end: ensureEndToolbar(),
		},
		customButtons: makeCustomButtons(),
		events: eventsList,

		// Umschaltbarer Modus
		eventDisplay: isAggregate() ? 'none' : 'auto',
		dayCellContent: isAggregate() ? dayCellContentAgg : undefined,
		dayCellDidMount: isAggregate() ? dayCellDidMountAgg : undefined,
		eventClick: isAggregate() ? undefined : onEventClick,
	};

	const { styleable } = getContext('sdk');
	const component = getContext('component');
</script>

<div use:styleable={$component.styles}>
	<FullCalendar {options} />
</div>

<style>
	.bbfc-wrap {
		position: relative;
		height: 100%;
		width: 100%;
	}

	.bbfc-daynum {
		position: absolute;
		top: 0.35rem;
		left: 0.5rem;
		font-weight: 600;
		font-size: 0.9rem;
		color: #1a1a1a;
		opacity: 0.9;
		pointer-events: none;
	}
	.bbfc-badge {
		margin-left: 0.35rem;
		padding: 0.05rem 0.35rem;
		border-radius: 0.4rem;
		font-size: 0.7rem;
		font-weight: 700;
		color: #0f172a;
		background: rgba(255, 255, 255, 0.8);
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08) inset;
	}

	.bbfc-center {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.bbfc-label {
		font-size: 1.05rem;
		font-weight: 700;
		line-height: 1.15;
		color: #0f172a;
		text-align: center;
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.25);
		padding: 0 0.35rem;
	}

	/* Fallback-Highlight-Klasse (zusätzlich zur Inset-Boxshadow im Code) */
	.bbfc-today {
		outline: 3px solid rgba(0, 0, 0, 0.35);
		outline-offset: -2px;
	}

	.bbfc-colored:hover {
		filter: brightness(0.96);
	}
</style>
