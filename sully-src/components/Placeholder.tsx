export default function Placeholder({ name }:{ name:string }){
  return (
    <div style={{padding:'60px 30px', textAlign:'center'}}>
      <h2 className="italianno" style={{fontSize:48, color:'#FF8FA3', margin:'0 0 12px', fontWeight:400}}>{name}</h2>
      <p className="garamond" style={{fontSize:14, color:'#9c6b7f', lineHeight:1.7}}>
        Coming soon.<br/>
        这只是个图标先占着位.<br/>
        想用了我就把里面填上.
      </p>
    </div>
  )
}
