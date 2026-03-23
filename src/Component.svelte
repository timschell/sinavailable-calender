<script>
	import { getContext, onMount, onDestroy } from 'svelte';
	import { Calendar } from '@fullcalendar/core';
	import '@fullcalendar/core/locales-all';
	import dayGridPlugin from '@fullcalendar/daygrid';
	import timeGridPlugin from '@fullcalendar/timegrid';
	import listPlugin from '@fullcalendar/list';
	import interactionPlugin from '@fullcalendar/interaction';
	import { langs, codeLang } from './lang';

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
	export let viewMode = 'counts';
	export let thresholdMin = 1;
	export let thresholdMax = 6;
	export let colorMin = 'rgba(244,67,54,0.35)';
	export let colorNeutral = 'rgba(255,235,59,0.35)';
	export let colorMax = 'rgba(76,175,80,0.35)';
	export let displayTemplate = '';
	export let displayTemplateSingular = 'Es ist {count} SINA-Gerät verfügbar';
	export let displayTemplatePlural = 'Es sind {count} SINA-Geräte verfügbar';
	export let debug = false;

	let calendarEl;
	let calendar = null;
	let timer = null;
	let _byDate = {};
	let _counts = {};
	let _initialized = false;

	// Heute ohne Uhrzeit für Vergleiche
	const todayISO = () => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
	};

	const isPast = (dateOrStr) => {
		const k = typeof dateOrStr === 'string' ? dateOrStr : dayKey(dateOrStr);
		return k < todayISO();
	};

	const parseToDate = (val) => {
		if (!val) return null;
		if (val instanceof Date) return isNaN(val) ? null : val;
		if (typeof val === 'number') { const d = new Date(val); return isNaN(d)?null:d; }
		if (typeof val === 'string') {
			const s = val.trim();
			const m1 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
			if (m1) { const d=new Date(+m1[3],+m1[2]-1,+m1[1],m1[4]?+m1[4]:0,m1[5]?+m1[5]:0,m1[6]?+m1[6]:0); return isNaN(d)?null:d; }
			const m2 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
			if (m2) { const d=new Date(+m2[3],+m2[2]-1,+m2[1]); return isNaN(d)?null:d; }
			const m3 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
			if (m3) { const d=new Date(+m3[1],+m3[2]-1,+m3[3]); return isNaN(d)?null:d; }
			const d=new Date(s); return isNaN(d)?null:d;
		}
		return null;
	};

	const toISO = (val) => {
		const d = parseToDate(val);
		if (!d) return null;
		return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
	};

	const dayKey = (d) =>
		`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

	function buildData() {
		const list=[],byDate={},counts={};
		const add=(ev)=>{
			const k=toISO(ev.date)||toISO(ev.start); if(!k)return;
			if(!byDate[k])byDate[k]=[];
			byDate[k].push(ev); counts[k]=(counts[k]||0)+1;
		};
		const push=(rows,map)=>{
			if(!rows)return;
			rows.forEach(row=>{
				const ev={title:row?.[map.title],date:row?.[map.date],start:row?.[map.start],end:row?.[map.end],color:map.color??'#313131',event:row,allDay:map.allday};
				list.push(ev); add(ev);
			});
		};
		push(dataProvider?.rows,{title:mappingTitle,date:mappingDate,start:mappingStart,end:mappingEnd,color:mappingColor,allday});
		push(dataProvider2?.rows,{title:mappingTitle2,date:mappingDate2,start:mappingStart2,end:mappingEnd2,color:mappingColor2,allday:allday2});
		if(debug) console.log('[Calendar 2.2.0] counts:',counts);
		_byDate = byDate;
		_counts = counts;
		return {list,byDate,counts};
	}

	const isAgg=()=>viewMode==='counts';
	const colorFor=(c)=>c>=thresholdMax?colorMax:c<=thresholdMin?colorMin:colorNeutral;
	const sod=(d)=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
	const isToday=(d)=>sod(d).getTime()===sod(new Date()).getTime();

	const fmtDisplay=(dt,count)=>{
		const iso=dayKey(dt);
		const wd=dt.toLocaleDateString(language||'de',{weekday:'short'});
		const dh=dt.toLocaleDateString(language||'de',{day:'2-digit',month:'2-digit',year:'numeric'});
		const tpl=displayTemplate?.trim()?displayTemplate:count===1?displayTemplateSingular:displayTemplatePlural;
		return tpl.replaceAll('{count}',String(count)).replaceAll('{iso}',iso).replaceAll('{weekday}',wd).replaceAll('{date}',dh);
	};

	const tierCls=(c)=>{
		if(c===0) return '';
		if(c>=thresholdMax) return 'tier-high';
		if(c<=thresholdMin) return 'tier-low';
		return 'tier-mid';
	};

	// Bestimmt ob für einen Tag überhaupt Daten vorhanden sind
	// (d.h. ob der Tag im beobachteten Zeitraum liegt)
	const hasDataForDay = (k, counts, dataProvider) => {
		// Wenn DataProvider Daten hat, prüfen ob der Tag im Range liegt
		const rows = dataProvider?.rows;
		if (!rows || rows.length === 0) return false;
		return true; // Vereinfacht: wenn Daten vorhanden sind, gelten alle Tage als "im System"
	};

	function makeCellContent(counts, dataHasRows) {
		return (arg) => {
			const k=dayKey(arg.date), c=counts[k]||0;
			const past=isPast(k);
			const today=isToday(arg.date);
			const cls=tierCls(c);
			const label=c>0?fmtDisplay(arg.date,c):'';

			// Vergangene Tage: kompakte Darstellung
			if (past && !today) {
				return {html:`
					<div class="bbfc-cell bbfc-past">
						<div class="bbfc-top">
							<span class="bbfc-dn">${arg.dayNumberText||''}</span>
							${c>0?`<span class="bbfc-dot ${cls} dot-sm"></span>`:''}
						</div>
						${c>0
							? `<div class="bbfc-body past-body"><span class="bbfc-num past-num">${c}</span></div>`
							: (dataHasRows ? `<div class="bbfc-body past-body"><span class="bbfc-blocked">—</span></div>` : '')
						}
					</div>
				`};
			}

			// Tage ohne verfügbare Geräte (ausgebucht) – nur wenn Daten vorhanden
			if (c === 0 && dataHasRows) {
				return {html:`
					<div class="bbfc-cell bbfc-booked">
						<div class="bbfc-top">
							<span class="bbfc-dn">${arg.dayNumberText||''}</span>
							<span class="bbfc-dot-none">✕</span>
						</div>
						<div class="bbfc-body">
							<span class="bbfc-booked-icon">⊘</span>
							<span class="bbfc-booked-lbl">Ausgebucht</span>
						</div>
					</div>
				`};
			}

			// Normaler Tag mit Geräten
			return {html:`
				<div class="bbfc-cell">
					<div class="bbfc-top">
						<span class="bbfc-dn">${arg.dayNumberText||''}</span>
						${c>0?`<span class="bbfc-dot ${cls}"></span>`:''}
					</div>
					${c>0?`<div class="bbfc-body"><span class="bbfc-num">${c}</span><span class="bbfc-lbl">${label}</span></div>`:''}
				</div>
			`};
		};
	}

	function makeCellMount(counts, dataHasRows) {
		return (arg) => {
			const k=dayKey(arg.date), c=counts[k]||0;
			const past=isPast(k);
			const today=isToday(arg.date);

			if (past && !today) {
				// Vergangene Tage: gedämpft, kein Cursor-Pointer
				arg.el.style.background = c > 0 ? colorFor(c) : 'transparent';
				arg.el.classList.add('is-past');
				arg.el.style.cursor = 'default';
			} else if (c === 0 && dataHasRows) {
				// Ausgebucht: rötlicher Hintergrund
				arg.el.style.background = 'rgba(239,68,68,0.08)';
				arg.el.classList.add('is-booked');
				arg.el.style.cursor = 'pointer';
			} else if (c > 0) {
				arg.el.style.background = colorFor(c);
				arg.el.classList.add('has-events');
				arg.el.style.cursor = 'pointer';
			} else {
				arg.el.style.cursor = 'pointer';
			}

			if (today) {
				arg.el.classList.add('is-today');
				arg.el.style.cursor = c > 0 ? 'pointer' : 'default';
			}
		};
	}

	function createCalendar() {
		if (!calendarEl || calendar) return;

		const {list,byDate,counts} = buildData();
		const dataHasRows = !!(dataProvider?.rows?.length > 0 || dataProvider2?.rows?.length > 0);

		const onDateClick=(info)=>{
			if(!isAgg()) return;
			const k=info.dateStr;
			if(isPast(k) && !isToday(new Date(k))) return; // Keine Aktion für vergangene Tage
			const evs=_byDate[k]||[];
			calendarEvent?.({
				value:{date:k,count:evs.length,events:evs,label:fmtDisplay(new Date(k),evs.length),isToday:isToday(new Date(k))},
				clickedDate:k
			});
		};

		const endBar=(()=>{const e=(headerOptionsEnd??'').trim();return e?`${e},toggleView`:'dayGridMonth,dayGridWeek,timeGridDay,toggleView';})();

		try {
			calendar = new Calendar(calendarEl, {
				plugins:[dayGridPlugin,listPlugin,timeGridPlugin,interactionPlugin],
				initialDate:new Date(),
				locale:language,
				dayMaxEvents:true,
				firstDay:1,
				height:'auto',
				...langs[codeLang(language)],
				headerToolbar:{start:headerOptionsStart,center:headerOptionsCenter,end:endBar},
				customButtons:{
					toggleView:{
						text:isAgg()?'Events':'Anzahl',
						click:()=>{viewMode=isAgg()?'events':'counts'; refreshCalendar();},
					},
				},
				events:list,
				eventDisplay:isAgg()?'none':'auto',
				dayCellContent:isAgg()?makeCellContent(counts, dataHasRows):undefined,
				dayCellDidMount:isAgg()?makeCellMount(counts, dataHasRows):undefined,
				dateClick:onDateClick,
				eventClick:isAgg()?undefined:(ev)=>{
					const s=ev?.event?.start;
					calendarEvent?.({value:ev.event,rowId:ev?.event?.extendedProps?.event?._id||'',clickedDate:s?dayKey(s):''});
				},
			});
			calendar.render();
			_initialized = true;
		} catch(err) {
			console.error('[Calendar 2.2.0] Error:',err);
			calendar=null;
		}
	}

	function refreshCalendar() {
		if (!calendar) { createCalendar(); return; }

		const {list,byDate,counts} = buildData();
		const dataHasRows = !!(dataProvider?.rows?.length > 0 || dataProvider2?.rows?.length > 0);

		calendar.removeAllEventSources();
		calendar.addEventSource(list);
		calendar.setOption('eventDisplay', isAgg() ? 'none' : 'auto');
		calendar.setOption('dayCellContent', isAgg() ? makeCellContent(counts, dataHasRows) : undefined);
		calendar.setOption('dayCellDidMount', isAgg() ? makeCellMount(counts, dataHasRows) : undefined);
		calendar.setOption('customButtons', {
			toggleView:{
				text:isAgg()?'Events':'Anzahl',
				click:()=>{viewMode=isAgg()?'events':'counts'; refreshCalendar();},
			},
		});
		const endBar=(()=>{const e=(headerOptionsEnd??'').trim();return e?`${e},toggleView`:'dayGridMonth,dayGridWeek,timeGridDay,toggleView';})();
		calendar.setOption('headerToolbar', {start:headerOptionsStart, center:headerOptionsCenter, end:endBar});
		calendar.render();
	}

	function schedule() {
		if(timer) clearTimeout(timer);
		timer=setTimeout(refreshCalendar, 50);
	}

	onMount(()=>{ timer=setTimeout(createCalendar, 0); });
	onDestroy(()=>{
		if(timer) clearTimeout(timer);
		if(calendar){try{calendar.destroy();}catch(e){}}
	});

	$: if (_initialized) {
		void dataProvider?.rows; void dataProvider2?.rows;
		void mappingTitle; void mappingDate; void mappingStart; void mappingEnd;
		void mappingTitle2; void mappingDate2; void mappingStart2; void mappingEnd2;
		void thresholdMin; void thresholdMax;
		void colorMin; void colorNeutral; void colorMax;
		void viewMode; void language;
		schedule();
	}

	const {styleable}=getContext('sdk');
	const component=getContext('component');
</script>

<div use:styleable={$component.styles} class="bbfc-container">
	<div bind:this={calendarEl} class="bbfc-inner"></div>
</div>

<style>
	.bbfc-container { width: 100%; display: block; }
	.bbfc-inner {
		width: 100%;
		border-radius: 16px;
		overflow: hidden;
		box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.08);
		background: #fff;
	}

	/* ── Toolbar ──────────────────────────────────────────────────────────── */
	:global(.bbfc-inner .fc-header-toolbar) {
		padding: 18px 24px 14px !important;
		background: #fff;
		border-bottom: 1px solid #f1f5f9;
		margin-bottom: 0 !important;
	}
	:global(.bbfc-inner .fc-toolbar-title) {
		font-size: 1.25rem !important;
		font-weight: 700 !important;
		color: #0f172a !important;
		letter-spacing: -0.02em !important;
	}
	:global(.bbfc-inner .fc-button) {
		background: #f8fafc !important;
		border: 1px solid #e2e8f0 !important;
		color: #475569 !important;
		border-radius: 8px !important;
		font-size: 0.78rem !important;
		font-weight: 600 !important;
		padding: 5px 12px !important;
		transition: background 0.12s, border-color 0.12s, color 0.12s !important;
		box-shadow: none !important;
		text-shadow: none !important;
	}
	:global(.bbfc-inner .fc-button:hover) {
		background: #f1f5f9 !important;
		border-color: #cbd5e1 !important;
		color: #1e293b !important;
	}
	:global(.bbfc-inner .fc-button-active),
	:global(.bbfc-inner .fc-button:focus) {
		background: #1e293b !important;
		border-color: #1e293b !important;
		color: #fff !important;
		box-shadow: none !important;
		outline: none !important;
	}
	:global(.bbfc-inner .fc-button-group .fc-button) { border-radius: 0 !important; }
	:global(.bbfc-inner .fc-button-group .fc-button:first-child) { border-radius: 8px 0 0 8px !important; }
	:global(.bbfc-inner .fc-button-group .fc-button:last-child) { border-radius: 0 8px 8px 0 !important; }
	:global(.bbfc-inner .fc-today-button) { border-radius: 8px !important; }
	:global(.bbfc-inner .fc-today-button:disabled) { opacity: 0.35 !important; }

	/* ── Grid ─────────────────────────────────────────────────────────────── */
	:global(.bbfc-inner .fc-col-header) { background: #f8fafc; }
	:global(.bbfc-inner .fc-col-header-cell) {
		padding: 9px 0 !important;
		border: none !important;
		border-bottom: 1px solid #e2e8f0 !important;
	}
	:global(.bbfc-inner .fc-col-header-cell-cushion) {
		font-size: 0.7rem !important;
		font-weight: 700 !important;
		letter-spacing: 0.09em !important;
		text-transform: uppercase !important;
		color: #94a3b8 !important;
		text-decoration: none !important;
	}
	:global(.bbfc-inner .fc-scrollgrid) {
		border: none !important;
		border-top: 1px solid #e2e8f0 !important;
	}
	:global(.bbfc-inner .fc-scrollgrid td),
	:global(.bbfc-inner .fc-scrollgrid th) { border-color: #f1f5f9 !important; }

	/* ── Day Cells ────────────────────────────────────────────────────────── */
	:global(.bbfc-inner .fc-daygrid-day) { cursor: pointer; }
	:global(.bbfc-inner .fc-day-today) { background: inherit !important; }
	:global(.bbfc-inner .fc-daygrid-day-frame) {
		position: relative !important;
		min-height: 95px !important;
		padding: 0 !important;
		display: flex !important;
		flex-direction: column !important;
	}
	/* Hover-Overlay – kein filter, kein Flackern */
	:global(.bbfc-inner .fc-daygrid-day-frame::after) {
		content: '';
		position: absolute;
		inset: 0;
		background: transparent;
		transition: background 0.12s ease;
		pointer-events: none;
		z-index: 1;
	}
	:global(.bbfc-inner .fc-daygrid-day:not(.is-past):hover .fc-daygrid-day-frame::after) {
		background: rgba(0,0,0,0.05);
	}
	:global(.bbfc-inner .fc-daygrid-day-top) {
		flex: 1 !important;
		padding: 0 !important;
		margin: 0 !important;
		display: block !important;
	}
	:global(.bbfc-inner .fc-daygrid-day-events) { display: none !important; }
	:global(.bbfc-inner .fc-daygrid-day-bg) { display: none !important; }
	:global(.bbfc-inner .fc-day-other) { opacity: 0.4; }
	:global(.bbfc-inner .fc-day-other .fc-daygrid-day-frame) { opacity: 1; }
	:global(.bbfc-inner .fc-daygrid-day.is-today) {
		outline: 2px solid #3b82f6 !important;
		outline-offset: -2px !important;
	}

	/* ── Vergangene Tage ──────────────────────────────────────────────────── */
	:global(.bbfc-inner .fc-daygrid-day.is-past) {
		cursor: default !important;
		opacity: 0.55;
	}
	:global(.bbfc-inner .fc-daygrid-day.is-past .fc-daygrid-day-frame::after) {
		display: none; /* Kein Hover-Effekt auf vergangenen Tagen */
	}

	/* ── Ausgebuchte Tage ─────────────────────────────────────────────────── */
	:global(.bbfc-inner .fc-daygrid-day.is-booked .fc-daygrid-day-frame::after) {
		/* Leichter roter Shimmer beim Hover */
	}
	:global(.bbfc-inner .fc-daygrid-day.is-booked:hover .fc-daygrid-day-frame::after) {
		background: rgba(239,68,68,0.06);
	}

	/* ── Custom Cell ──────────────────────────────────────────────────────── */
	:global(.bbfc-cell) {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		min-height: 95px;
		padding: 7px 8px;
		box-sizing: border-box;
		gap: 2px;
	}
	:global(.bbfc-top) {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 4px;
	}
	:global(.bbfc-dn) {
		font-size: 0.82rem;
		font-weight: 600;
		color: #64748b;
		line-height: 1.4;
		font-variant-numeric: tabular-nums;
		min-width: 20px;
	}
	:global(.fc-day-today .bbfc-dn) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: #3b82f6;
		color: #fff;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		font-size: 0.72rem;
		font-weight: 700;
	}
	:global(.bbfc-dot) {
		margin-top: 3px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	:global(.bbfc-dot.tier-high) { background: #22c55e; }
	:global(.bbfc-dot.tier-mid)  { background: #f59e0b; }
	:global(.bbfc-dot.tier-low)  { background: #ef4444; }
	:global(.bbfc-dot.dot-sm) { width: 6px; height: 6px; margin-top: 4px; }
	:global(.bbfc-body) {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		gap: 3px;
	}
	:global(.bbfc-num) {
		font-size: 1.75rem;
		font-weight: 800;
		line-height: 1;
		color: #0f172a;
		letter-spacing: -0.04em;
		font-variant-numeric: tabular-nums;
	}
	:global(.bbfc-lbl) {
		font-size: 0.58rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #475569;
		text-align: center;
		line-height: 1.3;
		max-width: 90%;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	/* Vergangene Tage: gedämpft */
	:global(.bbfc-past .bbfc-dn) { color: #94a3b8; }
	:global(.past-body) { gap: 0 !important; }
	:global(.past-num) {
		font-size: 1.2rem !important;
		font-weight: 700 !important;
		color: #94a3b8 !important;
	}
	:global(.bbfc-blocked) {
		font-size: 1.1rem;
		color: #cbd5e1;
		font-weight: 300;
	}

	/* Ausgebuchte Tage */
	:global(.bbfc-booked-icon) {
		font-size: 1.3rem;
		color: #fca5a5;
		line-height: 1;
	}
	:global(.bbfc-booked-lbl) {
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #ef4444;
		text-align: center;
	}
	:global(.bbfc-dot-none) {
		font-size: 0.6rem;
		color: #fca5a5;
		font-weight: 700;
		margin-top: 2px;
	}

	/* ── Events-Modus ─────────────────────────────────────────────────────── */
	:global(.bbfc-inner .fc-event) {
		border: none !important;
		border-radius: 4px !important;
		font-size: 0.72rem !important;
		font-weight: 600 !important;
		padding: 1px 5px !important;
		cursor: pointer;
	}
	:global(.bbfc-inner .fc-event:hover) { opacity: 0.85 !important; }

	/* ── List View ────────────────────────────────────────────────────────── */
	:global(.bbfc-inner .fc-list-table) { border: none !important; }
	:global(.bbfc-inner .fc-list-day-cushion) {
		background: #f8fafc !important;
		font-weight: 700 !important;
		font-size: 0.75rem !important;
		letter-spacing: 0.06em !important;
		text-transform: uppercase !important;
		color: #64748b !important;
		padding: 8px 16px !important;
	}
	:global(.bbfc-inner .fc-list-event:hover td) {
		background: #f8fafc !important;
		cursor: pointer;
	}
	:global(.bbfc-inner .fc-list-event-dot) { border-radius: 50% !important; }
</style>
