import './RouletteBetTable.css';

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const ROWS = [
  Array.from({length:12},(_,i)=>(i+1)*3),
  Array.from({length:12},(_,i)=>(i+1)*3-1),
  Array.from({length:12},(_,i)=>(i+1)*3-2),
];

export default function RouletteBetTable({ selectedType, selectedChoice, onSelect }: {
  selectedType: string;
  selectedChoice: string;
  onSelect: (type:string,choice:string)=>void;
}) {
  const active=(type:string,choice:string)=>selectedType===type&&selectedChoice===choice;
  return (
    <div className="roulette-felt-table">
      <div className="roulette-felt-heading"><span>EUROPEAN ROULETTE</span><small>SELECT A BET ON THE TABLE</small></div>
      <div className="roulette-number-area">
        <button type="button" aria-pressed={active('number','number_0')} className={'roulette-felt-zero'+(active('number','number_0')?' selected':'')} onClick={()=>onSelect('number','number_0')}>0</button>
        <div className="roulette-felt-grid">
          {ROWS.map((row,rowIndex)=><div className="roulette-felt-row" key={rowIndex}>{row.map(number=><button type="button" key={number} aria-pressed={active('number','number_'+number)} className={'roulette-felt-number '+(RED.has(number)?'red':'black')+(active('number','number_'+number)?' selected':'')} onClick={()=>onSelect('number','number_'+number)}>{number}</button>)}</div>)}
        </div>
        <div className="roulette-felt-columns">
          {['column3','column2','column1'].map((column,index)=><button type="button" key={column} aria-pressed={active('column',column)} className={active('column',column)?'selected':''} onClick={()=>onSelect('column',column)}><b>2:1</b><small>COL {3-index}</small></button>)}
        </div>
      </div>
      <div className="roulette-felt-dozens">
        {['dozen1','dozen2','dozen3'].map((dozen,index)=><button type="button" key={dozen} aria-pressed={active('dozen',dozen)} className={active('dozen',dozen)?'selected':''} onClick={()=>onSelect('dozen',dozen)}><b>2:1</b><small>{index*12+1}–{(index+1)*12}</small></button>)}
      </div>
      <div className="roulette-felt-outside">
        {[
          ['range','low','1–18'],['parity','even','EVEN'],['colour','red','RED'],
          ['colour','black','BLACK'],['parity','odd','ODD'],['range','high','19–36'],
        ].map(([type,choice,label])=><button type="button" key={type+choice} aria-pressed={active(type,choice)} className={(type==='colour'?choice:'')+(active(type,choice)?' selected':'')} onClick={()=>onSelect(type,choice)}>{label}</button>)}
      </div>
      <div className="roulette-felt-legend"><span><i className="red-dot"/> RED</span><span><i className="black-dot"/> BLACK</span><span><i className="green-dot"/> ZERO</span></div>
    </div>
  );
}
