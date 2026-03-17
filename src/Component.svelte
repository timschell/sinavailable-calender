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
	// byDate und counts als Closure-Variablen damit dateClick drauf zugreifen kann
	let _byDate = {};
	let _counts = {};

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
		if(debug) console.log('[Calendar 1.9.0] counts:',counts);
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

	function initCalendar() {
		if (!calendarEl) return;
		if (calendar) { try { calendar.destroy(); } catch(e){} calendar=null; }

		const {list,byDate,counts} = buildData();

		const cellMount=(arg)=>{
			const k=dayKey(arg.date),c=counts[k]||0;
			arg.el.style.background=colorFor(c);
			arg.el.style.borderRadius='6px';
			if(isToday(arg.date)){arg.el.classList.add('bbfc-today');arg.el.style.boxShadow='inset 0 0 0 3px rgba(0,0,0,0.45)';}
			else{arg.el.classList.remove('bbfc-today');arg.el.style.boxShadow='';}
			arg.el.style.cursor='pointer';
			arg.el.title=c>0?fmtDisplay(arg.date,c):'';
		};

		const cellContent=(arg)=>{
			const k=dayKey(arg.date),c=counts[k]||0;
			const label=c>0?fmtDisplay(arg.date,c):'';
			return{html:`<div class="bbfc-wrap"><div class="bbfc-daynum">${arg.dayNumberText||''}</div><div class="bbfc-center">${label?`<span class="bbfc-label">${label}</span>`:''}</div></div>`};
		};

		// dateClick: FullCalendar's nativer Handler – zuverlässig, kein DOM-Event-Konflikt
		const onDateClick=(info)=>{
			if(!isAgg()) return;
			const k=info.dateStr; // YYYY-MM-DD
			const evs=_byDate[k]||[];
			const c=evs.length;
			if(debug) console.log('[Calendar 1.9.0] dateClick', k, c, evs);
			calendarEvent?.({
				value:{date:k,count:c,events:evs,label:fmtDisplay(new Date(k),c),isToday:isToday(new Date(k))},
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
						click:()=>{viewMode=isAgg()?'events':'counts';schedule();},
					},
				},
				events:list,
				eventDisplay:isAgg()?'none':'auto',
				dayCellContent:isAgg()?cellContent:undefined,
				dayCellDidMount:isAgg()?cellMount:undefined,
				// dateClick statt manueller addEventListener – von FullCalendar korrekt verarbeitet
				dateClick:onDateClick,
				eventClick:isAgg()?undefined:(ev)=>{
					const s=ev?.event?.start;
					calendarEvent?.({value:ev.event,rowId:ev?.event?.extendedProps?.event?._id||'',clickedDate:s?dayKey(s):''});
				},
			});
			calendar.render();
			console.log('[Calendar 1.9.0] OK');
		} catch(err) {
			console.error('[Calendar 1.9.0] Error:',err);
			calendar=null;
		}
	}

	function schedule() {
		if(timer) clearTimeout(timer);
		timer=setTimeout(initCalendar,50);
	}

	onMount(()=>{ timer=setTimeout(initCalendar,0); });

	onDestroy(()=>{
		if(timer) clearTimeout(timer);
		if(calendar){try{calendar.destroy();}catch(e){}}
	});

	$: JSON.stringify({
		a:dataProvider?.rows, b:dataProvider2?.rows,
		maps:{mappingTitle,mappingDate,mappingStart,mappingEnd,mappingTitle2,mappingDate2,mappingStart2,mappingEnd2},
		t:{thresholdMin,thresholdMax}, c:{colorMin,colorNeutral,colorMax},
		vm:viewMode, lang:language,
	}), calendar && schedule();

	const {styleable}=getContext('sdk');
	const component=getContext('component');
</script>

<div use:styleable={$component.styles} class="bbfc-container">
	<div bind:this={calendarEl} class="bbfc-inner"></div>
</div>

<style>
	.bbfc-container{min-height:500px;width:100%;display:block;}
	.bbfc-inner{width:100%;min-height:500px;}
	:global(.bbfc-wrap){position:relative;height:100%;width:100%;}
	:global(.bbfc-daynum){position:absolute;top:0.35rem;left:0.5rem;font-weight:600;font-size:0.9rem;color:#1a1a1a;opacity:0.9;pointer-events:none;}
	:global(.bbfc-center){position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;}
	:global(.bbfc-label){font-size:1.05rem;font-weight:700;line-height:1.15;color:#0f172a;text-align:center;text-shadow:0 1px 0 rgba(255,255,255,0.25);padding:0 0.35rem;}
	:global(.bbfc-today){outline:3px solid rgba(0,0,0,0.35);outline-offset:-2px;}
</style>
