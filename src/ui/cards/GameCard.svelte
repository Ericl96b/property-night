<script lang="ts">
  // The shared card (Stage 3 §2): one component, three sizes (thumb 92×122, std 200×266,
  // detail 360×480). Values follow the approved mock-ups (docs/stage3/…/source/lib.js).
  import { symbolUrl } from '../../render/symbols';
  import Banknote from '../components/Banknote.svelte';
  import { liveRentIndex, money, notesFor, type CardItem, type CardSize } from './model';

  let { item, size = 'thumb' }: { item: CardItem; size?: CardSize } = $props();

  const deedIcon = (d: { kind: string; utility?: string }) =>
    symbolUrl(d.kind === 'railroad' ? 'railroad' : d.utility === 'water' ? 'utility-water' : 'utility-power');
  const ROW_LABELS = ['With 1 house', 'With 2 houses', 'With 3 houses', 'With 4 houses', 'With hotel'];
  const RAIL_LABELS = ['Rent', 'If 2 lines are owned', 'If 3 lines are owned', 'If 4 lines are owned'];
  const ROT = [-4, 2, -2, 1];
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
</script>

{#snippet bldIcons(n: number, s: number)}
  {#if n === 5}
    <svg width={s * 1.6} height={s} viewBox="0 0 26 16" aria-hidden="true"><path d="M1.5 7 13 2l11.5 5v7.5h-23z" fill="#B4322A" stroke="#6E1B15" stroke-width="1.2" stroke-linejoin="round" /></svg>
  {:else}
    {#each Array(n) as _}
      <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8.2 8 2.4l6.5 5.8v6.3h-13z" fill="#2E8B4E" stroke="#1B4D2E" stroke-width="1.2" stroke-linejoin="round" /><path d="M4.2 8.6 8 5.2" stroke="#7FC79A" stroke-width="1" stroke-linecap="round" /></svg>
    {/each}
  {/if}
{/snippet}

{#if item.t === 'deed'}
  {@const d = item}
  {#if d.mortgaged}
    <div class="card {size} back" data-kind="mortgaged">
      <div class="frame"></div>
      <div class="mstrip" style="background:{d.color}"></div>
      {#if size === 'thumb'}
        <div class="tname">{d.name}</div>
        <div class="mstamp s">MORTGAGED</div>
      {:else if size === 'std'}
        <div class="sname">{d.name}</div>
        <div class="mstamp m">MORTGAGED</div>
        <div class="sline b">Mortgaged for {money(d.mortgage)}</div>
        <div class="sline">Unmortgage {money(d.unmortgage)}</div>
      {:else}
        <div class="dmname">{d.name}</div>
        <div class="mstamp l">MORTGAGED</div>
        <div class="dline b">Mortgaged for {money(d.mortgage)}</div>
        <div class="dline">Unmortgage for {money(d.unmortgage)}</div>
        <div class="dnote">Lifting the mortgage costs the value plus 10%.</div>
      {/if}
    </div>
  {:else if d.kind !== 'street'}
    <div class="card {size}" data-kind={d.kind}>
      <div class="frame"></div>
      {#if size === 'thumb'}
        <img class="ticon" src={deedIcon(d)} alt="" width="40" height="40" />
        <div class="tname">{d.name}</div>
      {:else if size === 'std'}
        <img class="sicon" src={deedIcon(d)} alt="" width="58" height="58" />
        <div class="kick muted">{d.kind === 'railroad' ? 'RAILROAD' : 'UTILITY'}</div>
        <div class="sname">{d.name}</div>
        <div class="sline b">{d.kind === 'railroad' ? `Rent ${money(d.rents[0])} – ${money(d.rents[d.rents.length - 1])}` : `${d.multipliers[0]}× or ${d.multipliers[1]}× the dice`}</div>
        <div class="sline">Mortgage {money(d.mortgage)}</div>
      {:else}
        <div class="dc">
          <img src={deedIcon(d)} alt="" width="84" height="84" />
          <div class="kick muted">{d.kind === 'railroad' ? 'RAILROAD' : 'UTILITY'}</div>
          <div class="dtitle2">{d.name}</div>
          {#if d.kind === 'railroad'}
            <div class="rows">
              {#each d.rents as r, i}
                <div class="row" class:now={i === liveRentIndex(d) && d.ownedInGroup > 0}><span>{RAIL_LABELS[i]}</span><span class="dots"></span><b>{money(r)}</b></div>
              {/each}
            </div>
          {:else}
            <div class="util" class:now={d.ownedInGroup === 1}>With one utility owned, rent is <b>{d.multipliers[0]}×</b> the dice roll.</div>
            <div class="util" class:now={d.ownedInGroup === 2}>With both utilities owned, rent is <b>{d.multipliers[1]}×</b> the dice roll.</div>
          {/if}
          <div class="rule"></div>
          <div class="dnotes">Mortgage value {money(d.mortgage)}</div>
        </div>
      {/if}
    </div>
  {:else}
    <div class="card {size}" data-kind="street">
      <div class="frame"></div>
      {#if size === 'thumb'}
        <div class="tband" style="background:{d.color}"></div>
        <div class="tname">{d.name}</div>
        <div class="tbld">{@render bldIcons(d.buildings, 15)}</div>
      {:else if size === 'std'}
        <div class="sband" style="background:{d.color};color:{d.light ? '#FFF8EC' : '#2B2119'}">
          <div class="kick">TITLE DEED</div>
          <div class="sbname">{d.name}</div>
        </div>
        <div class="srent">Rent {money(d.rents[0])}</div>
        <div class="sline">1–4 houses {d.rents.slice(1, 5).map((r) => money(r)).join(' · ')}</div>
        <div class="sline">Hotel {money(d.rents[5])}</div>
        <div class="sline muted2">Houses {money(d.houseCost)} · Mortgage {money(d.mortgage)}</div>
        <div class="sbld">{@render bldIcons(d.buildings, 18)}</div>
      {:else}
        <div class="dband" style="background:{d.color};color:{d.light ? '#FFF8EC' : '#2B2119'}">
          <div class="kick">TITLE DEED</div>
          <div class="dtitle">{d.name}</div>
        </div>
        <div class="drent" class:now={d.buildings === 0}>Rent {money(d.rents[0])}{#if d.buildings === 0 && d.fullSet}<span class="x2"> · {money(d.rents[0] * 2)} with the set</span>{/if}</div>
        <div class="rows">
          {#each ROW_LABELS as l, i}
            <div class="row" class:now={d.buildings === i + 1}><span>{l}</span><span class="dots"></span><b>{money(d.rents[i + 1])}</b></div>
          {/each}
        </div>
        <div class="rule"></div>
        <div class="dnotes">
          <div>Mortgage value {money(d.mortgage)}</div>
          <div>Houses cost {money(d.houseCost)} each</div>
          <div>Hotels, {money(d.houseCost)} each plus 4 houses</div>
        </div>
        <div class="dfoot">Own every lot in the color set and rent doubles on lots without houses.</div>
      {/if}
    </div>
  {/if}
{:else if item.t === 'gojf'}
  {@const chest = item.deck === 'chest'}
  <div class="card {size} gojf" class:chest data-kind="gojf">
    <div class="ob1"></div>
    <div class="ob2"></div>
    <span class="dia tl"></span><span class="dia tr"></span><span class="dia bl"></span><span class="dia br"></span>
    {#if chest}
      <img class="q {size === 'thumb' ? 's' : size === 'std' ? 'm' : 'l'} chestq" src={symbolUrl('community-chest')} alt="" />
    {:else}
      <div class="q {size === 'thumb' ? 's' : size === 'std' ? 'm' : 'l'}">?</div>
    {/if}
    {#if size === 'thumb'}
      <div class="gname">Get Out of Jail Free</div>
    {:else if size === 'std'}
      <div class="kick ox">{chest ? 'COMMUNITY CHEST' : 'CHANCE'}</div>
      <div class="gname m">Get Out of Jail Free</div>
      <div class="sline">Keep it, use it, or trade it.</div>
    {:else}
      <div class="kick ox big">{chest ? 'COMMUNITY CHEST' : 'CHANCE'}</div>
      <div class="gname l">Get Out of Jail Free</div>
      <div class="dline">This card may be kept until needed or traded.</div>
      <div class="dnote">Goes back to the {chest ? 'Community Chest' : 'Chance'} deck once used.</div>
    {/if}
  </div>
{:else if item.t === 'cash'}
  {@const ns = notesFor(item.amount)}
  <div class="cashc {size}" data-kind="cash">
    {#if size === 'thumb'}
      {#each ns.slice(0, 3).reverse() as v, i}
        <div class="nt" style="top:{8 + i * 9}px;left:{4 + i * 2}px;transform:rotate({[-4, 2, -1][i]}deg)"><Banknote value={v} width={80} /></div>
      {/each}
    {:else}
      {#each ns.slice(0, 4).reverse() as v, i}
        {@const std = size === 'std'}
        <div class="nt" style="top:{(std ? 10 : 20) + i * (std ? 14 : 22)}px;left:{(std ? 12 : 24) + i * 3}px;transform:rotate({ROT[i]}deg)"><Banknote value={v} width={std ? 170 : 300} /></div>
      {/each}
    {/if}
    <div class="camt">{money(item.amount)}</div>
    {#if item.sub && size !== 'thumb'}<div class="csub">{item.sub}</div>{/if}
  </div>
{:else if item.t === 'voucher'}
  {@const v = item}
  {@const rf = v.kind === 'rentFree'}
  {@const unit = rf ? plural(v.total, 'landing', 'landings') : plural(v.total, 'round', 'rounds')}
  {@const leftUnit = rf ? plural(v.left, 'landing', 'landings') : plural(v.left, 'round', 'rounds')}
  {@const where = v.group === 'railroad' ? 'railroad' : v.group === 'utility' ? 'utility' : `${v.groupLabel} lot`}
  <div class="card {size} vch" style="--kc:{rf ? '#2F5D46' : '#8E2F23'}" data-kind="voucher">
    <div class="vcut"></div>
    <div class="vstripe" style="height:{size === 'thumb' ? 18 : size === 'std' ? 30 : 46}px;background:{v.color};color:{v.light ? '#FBF6EA' : '#2B2119'}">
      {#if v.group === 'railroad' || v.group === 'utility'}
        <img class="light" src={symbolUrl(v.group === 'railroad' ? 'railroad' : 'utility-power')} alt="" width={size === 'thumb' ? 12 : size === 'std' ? 24 : 40} height={size === 'thumb' ? 12 : size === 'std' ? 24 : 40} />
      {/if}
      {#if size !== 'thumb'}<span>{v.groupLabel.toUpperCase()}</span>{/if}
    </div>
    {#if size === 'thumb'}
      <div class="vt s">{rf ? 'RENT-FREE' : 'NO BUILD'}</div>
      <div class="vst s">{rf ? '×' : ''}{v.left}</div>
      <div class="vunit">{leftUnit}</div>
    {:else if size === 'std'}
      <div class="kick vk">PROMISE</div>
      <div class="vt m">{rf ? 'RENT-FREE' : 'NO BUILDING'}</div>
      <div class="vst m">{rf ? '×' : ''}{v.total} {unit.toUpperCase()}</div>
      <div class="vparty">{v.by.name} → {v.to.name}</div>
      {#if v.total <= 10}<div class="punch">{#each Array(v.total) as _, i}<span class:used={i < v.total - v.left}></span>{/each}</div>{:else}<div class="vleft">{v.left} left</div>{/if}
    {:else}
      <div class="kick vk big">PROMISE VOUCHER</div>
      <div class="vt l">{rf ? 'RENT-FREE' : 'NO BUILDING'}</div>
      <div class="vsub">{rf ? `on every ${where}` : 'Restricted Development'}</div>
      <div class="vst l">{rf ? '×' : ''}{v.total} {unit.toUpperCase()}</div>
      <div class="vterms">
        {#if rf}{v.to.name} pays {v.by.name} no rent on any {where} {v.by.name} owns, including ones {v.by.name} gets later.{:else}{v.by.name} can't build houses or hotels on {v.groupLabel}. Selling them is still allowed.{/if}
      </div>
      {#if v.total <= 10}<div class="punch">{#each Array(v.total) as _, i}<span class:used={i < v.total - v.left}></span>{/each}</div>{:else}<div class="vleft">{v.left} {leftUnit} left</div>{/if}
      <div class="vfoot">
        <div><span class="vfl">PROMISED BY</span><span class="vfn"><i style="background:{v.by.color}"></i>{v.by.name}</span></div>
        <div><span class="vfl">HELD BY</span><span class="vfn"><i style="background:{v.to.color}"></i>{v.to.name}</span></div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .card {
    position: relative;
    box-sizing: border-box;
    background: #fbf6ea;
    border-radius: 9px;
    box-shadow: 0 1px 0 #e2d2b0, 0 2px 0 #d2bd95, 0 3px 0 #c2aa7e, 0 4px 0 #a98f63, 0 14px 26px rgba(10, 5, 2, 0.35);
    color: #2b2119;
    flex: none;
    overflow: hidden;
    text-align: center;
  }
  .card * {
    box-sizing: border-box;
  }
  .frame {
    position: absolute;
    inset: 6px;
    box-shadow: inset 0 0 0 1.2px #2b2119;
    pointer-events: none;
  }
  .card.thumb {
    width: 92px;
    height: 122px;
    border-radius: 7px;
    box-shadow: 0 1px 0 #d2bd95, 0 2px 0 #a98f63, 0 7px 12px rgba(10, 5, 2, 0.3);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px 9px 8px;
  }
  .card.std {
    width: 200px;
    height: 266px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14px 13px 12px;
  }
  .card.detail {
    width: 360px;
    height: 480px;
    display: flex;
    flex-direction: column;
    padding: 21px 21px 18px;
    border-radius: 11px;
  }
  .card.std .frame {
    inset: 8px;
  }
  .card.detail .frame {
    inset: 11px;
    box-shadow: inset 0 0 0 1.5px #2b2119;
  }
  .tband {
    width: 100%;
    height: 26px;
    box-shadow: inset 0 0 0 1.2px #2b2119;
    flex: none;
  }
  .tname {
    font: 700 15px/1.12 'Fraunces', serif;
    font-variation-settings: 'opsz' 12;
    text-align: center;
    margin-top: 7px;
    flex: 1;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }
  .tbld {
    display: flex;
    gap: 1px;
    height: 16px;
    align-items: flex-end;
  }
  .ticon,
  .sicon {
    flex: none;
    margin-top: 2px;
  }
  .sicon {
    margin-top: 6px;
  }
  .back {
    align-items: center;
  }
  .card.detail.back {
    align-items: stretch;
  }
  .back .mstrip {
    width: 100%;
    height: 10px;
    box-shadow: inset 0 0 0 1.2px #2b2119;
    flex: none;
  }
  .std.back .mstrip {
    height: 14px;
  }
  .detail.back .mstrip {
    height: 20px;
  }
  .back .tname {
    flex: none;
  }
  .mstamp {
    color: #8e2f23;
    border: 2px solid #8e2f23;
    outline: 1px solid #8e2f23;
    outline-offset: 2px;
    font-family: 'Fraunces', serif;
    font-weight: 900;
    transform: rotate(-12deg);
    opacity: 0.92;
    white-space: nowrap;
    flex: none;
  }
  .mstamp.s {
    font: 800 14px/1 'Source Sans 3', sans-serif;
    letter-spacing: 0.5px;
    padding: 4px 4px;
    margin-top: 12px;
    transform: rotate(-9deg);
  }
  .mstamp.m {
    font-size: 20px;
    letter-spacing: 2px;
    padding: 6px 10px;
    margin: 22px 0;
  }
  .mstamp.l {
    font-size: 32px;
    letter-spacing: 3px;
    padding: 10px 18px;
    margin: 56px auto 48px;
  }
  .kick {
    font: 700 14px/1 'Source Sans 3', sans-serif;
    letter-spacing: 2.5px;
  }
  .kick.muted {
    color: #5e4c3b;
    margin-top: 8px;
  }
  .kick.ox {
    color: #8e2f23;
    margin-top: 6px;
  }
  .kick.big {
    font-size: 16px;
    letter-spacing: 3.5px;
  }
  .sband {
    width: 100%;
    box-shadow: inset 0 0 0 1.2px #2b2119;
    padding: 9px 6px 11px;
    flex: none;
  }
  .sbname {
    font: 800 18px/1.05 'Fraunces', serif;
    font-variation-settings: 'opsz' 36;
    text-transform: uppercase;
    margin-top: 6px;
  }
  .srent {
    font: 700 18px/1 'Fraunces', serif;
    margin: 13px 0 9px;
  }
  .sline {
    font: 500 15px/1.35 'Source Sans 3', sans-serif;
  }
  .sline.b {
    font-weight: 700;
    font-size: 16px;
  }
  .sline.muted2 {
    margin-top: 6px;
    color: #5e4c3b;
  }
  .sbld {
    margin-top: auto;
    display: flex;
    gap: 2px;
    height: 20px;
    align-items: flex-end;
  }
  .sname {
    font: 800 20px/1.08 'Fraunces', serif;
    text-transform: uppercase;
    margin: 8px 0 10px;
  }
  .dband {
    box-shadow: inset 0 0 0 1.5px #2b2119;
    padding: 13px 10px 15px;
    text-align: center;
    flex: none;
  }
  .dtitle {
    font: 800 28px/1.05 'Fraunces', serif;
    font-variation-settings: 'opsz' 36;
    text-transform: uppercase;
    margin-top: 8px;
    letter-spacing: 0.5px;
  }
  .drent {
    text-align: center;
    font: 700 21px/1 'Fraunces', serif;
    margin: 15px 0 9px;
    padding: 4px 0;
    border-radius: 4px;
  }
  .x2 {
    font: 600 15px/1 'Source Sans 3', sans-serif;
    color: #5e4c3b;
  }
  .rows {
    padding: 0 10px;
    display: flex;
    flex-direction: column;
    text-align: left;
  }
  .row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font: 500 17px/1.5 'Fraunces', serif;
    font-variation-settings: 'opsz' 12;
    padding: 0 6px;
    border-radius: 4px;
  }
  .row b {
    font-weight: 700;
  }
  .dots {
    flex: 1;
    border-bottom: 1.3px dotted rgba(43, 33, 25, 0.45);
    transform: translateY(-5px);
  }
  .now {
    background: rgba(195, 148, 69, 0.28);
    box-shadow: inset 3px 0 0 #c39445;
  }
  .rule {
    height: 1px;
    background: #2b2119;
    margin: 10px 10px 8px;
    flex: none;
    align-self: stretch;
  }
  .dnotes {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font: 500 15px/1.3 'Source Sans 3', sans-serif;
    text-align: center;
  }
  .dfoot {
    margin-top: auto;
    font: italic 400 14px/1.3 'Fraunces', serif;
    color: #5e4c3b;
    text-align: center;
    padding: 0 10px;
  }
  .dc {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    height: 100%;
    padding-top: 8px;
  }
  .dc .rows {
    align-self: stretch;
    margin-top: 14px;
  }
  .dc .rule {
    margin-top: auto;
  }
  .dtitle2 {
    font: 800 29px/1.05 'Fraunces', serif;
    text-transform: uppercase;
    margin: 8px 0 6px;
  }
  .util {
    font: 500 17px/1.45 'Fraunces', serif;
    margin-top: 12px;
    padding: 0 10px;
    border-radius: 4px;
  }
  .dmname {
    font: 800 28px/1.05 'Fraunces', serif;
    text-transform: uppercase;
    text-align: center;
    margin-top: 22px;
  }
  .dline {
    font: 600 18px/1.4 'Source Sans 3', sans-serif;
    text-align: center;
  }
  .dline.b {
    font-weight: 700;
  }
  .dnote {
    font: 500 15px/1.35 'Source Sans 3', sans-serif;
    color: #5e4c3b;
    text-align: center;
    margin-top: 10px;
    padding: 0 20px;
  }
  /* Get Out of Jail Free: Chance frame (oxblood), Community Chest frame (forest). */
  .gojf {
    --gc: #8e2f23;
    align-items: center;
  }
  .gojf.chest {
    --gc: #2f5d46;
  }
  .gojf .ob1 {
    position: absolute;
    inset: 5px;
    border: 2px solid var(--gc);
    border-radius: 4px;
  }
  .gojf .ob2 {
    position: absolute;
    inset: 10px;
    border: 0.8px solid var(--gc);
    border-radius: 2px;
  }
  .gojf .dia {
    position: absolute;
    width: 7px;
    height: 7px;
    background: var(--gc);
    transform: rotate(45deg);
  }
  .gojf .tl {
    top: 9px;
    left: 9px;
  }
  .gojf .tr {
    top: 9px;
    right: 9px;
  }
  .gojf .bl {
    bottom: 9px;
    left: 9px;
  }
  .gojf .br {
    bottom: 9px;
    right: 9px;
  }
  .std.gojf .ob1,
  .detail.gojf .ob1 {
    inset: 8px;
  }
  .std.gojf .ob2,
  .detail.gojf .ob2 {
    inset: 14px;
  }
  .std.gojf .tl,
  .detail.gojf .tl {
    top: 13px;
    left: 13px;
  }
  .std.gojf .tr,
  .detail.gojf .tr {
    top: 13px;
    right: 13px;
  }
  .std.gojf .bl,
  .detail.gojf .bl {
    bottom: 13px;
    left: 13px;
  }
  .std.gojf .br,
  .detail.gojf .br {
    bottom: 13px;
    right: 13px;
  }
  .gojf .kick.ox {
    color: var(--gc);
  }
  .q {
    font-family: 'Fraunces', serif;
    font-weight: 900;
    color: var(--gc);
    line-height: 1;
    border: 1.6px dashed var(--gc);
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex: none;
  }
  .q.chestq {
    padding: 8%;
    object-fit: contain;
  }
  .q.s {
    width: 46px;
    height: 46px;
    font-size: 32px;
    margin-top: 4px;
  }
  .q.m {
    width: 76px;
    height: 76px;
    font-size: 52px;
    margin-top: 10px;
  }
  .q.l {
    width: 130px;
    height: 130px;
    font-size: 92px;
    margin: 34px auto 6px;
  }
  .gname {
    font: 800 14px/1.1 'Fraunces', serif;
    text-transform: uppercase;
    text-align: center;
    margin-top: 7px;
  }
  .gname.m {
    font-size: 20px;
    margin: 8px 0;
  }
  .gname.l {
    font-size: 32px;
    margin: 12px 0 18px;
    line-height: 1.05;
  }
  .detail.gojf .dline {
    padding: 0 24px;
  }
  /* Cash: banknote stack plus an amount chip. */
  .cashc {
    position: relative;
    flex: none;
  }
  .cashc .nt {
    position: absolute;
    filter: drop-shadow(0 3px 4px rgba(15, 7, 2, 0.35));
  }
  .cashc .nt :global(svg) {
    display: block;
  }
  .cashc.thumb {
    width: 92px;
    height: 122px;
  }
  .cashc .camt {
    position: absolute;
    text-align: center;
    color: #2b2119;
    background: #fbf6ea;
  }
  .cashc.thumb .camt {
    left: 0;
    right: 0;
    bottom: 2px;
    font: 800 21px/1 'Fraunces', serif;
    border-radius: 6px;
    padding: 5px 0;
    box-shadow: 0 2px 6px rgba(10, 5, 2, 0.3);
  }
  .cashc.std {
    width: 200px;
    height: 266px;
  }
  .cashc.std .camt {
    left: 10px;
    right: 10px;
    bottom: 30px;
    font: 800 34px/1 'Fraunces', serif;
    border-radius: 8px;
    padding: 10px 0;
    box-shadow: 0 3px 8px rgba(10, 5, 2, 0.3);
  }
  .cashc .csub {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    text-align: center;
    font: 700 15px/1 'Source Sans 3', sans-serif;
    color: #fbf6ea;
  }
  .cashc.detail {
    width: 360px;
    height: 480px;
  }
  .cashc.detail .camt {
    left: 30px;
    right: 30px;
    bottom: 70px;
    font: 800 54px/1 'Fraunces', serif;
    border-radius: 10px;
    padding: 16px 0;
    box-shadow: 0 4px 10px rgba(10, 5, 2, 0.3);
  }
  /* Promise vouchers: dashed cut line, group stripe, stamp, punch holes. */
  .vcut {
    position: absolute;
    inset: 4px;
    border: 2px dashed var(--kc);
    border-radius: 6px;
    pointer-events: none;
    z-index: 2;
  }
  .std .vcut,
  .detail .vcut {
    inset: 7px;
  }
  .card.thumb.vch {
    padding: 8px 8px 7px;
  }
  .card.detail.vch {
    align-items: stretch;
  }
  .vstripe {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex: none;
    box-shadow: inset 0 0 0 1.2px #2b2119;
    font: 800 16px/1 'Source Sans 3', sans-serif;
    letter-spacing: 2.5px;
  }
  .detail .vstripe {
    font-size: 19px;
    letter-spacing: 3.5px;
  }
  .vstripe img.light {
    filter: invert(1) sepia(0.15);
  }
  .vt {
    font-family: 'Fraunces', serif;
    font-weight: 900;
    color: var(--kc);
    line-height: 1;
    text-align: center;
  }
  .vt.s {
    font: 800 14px/1 'Source Sans 3', sans-serif;
    margin-top: 7px;
    letter-spacing: 0.3px;
    white-space: nowrap;
  }
  .vt.m {
    font-size: 21px;
    margin-top: 4px;
    white-space: nowrap;
  }
  .vt.l {
    font-size: 42px;
    margin-top: 6px;
    letter-spacing: 1px;
  }
  .vk {
    color: var(--kc);
    margin-top: 12px;
    text-align: center;
  }
  .vsub {
    font: italic 500 18px/1.2 'Fraunces', serif;
    color: #5e4c3b;
    text-align: center;
    margin-top: 6px;
  }
  .vst {
    color: var(--kc);
    border: 2.5px solid var(--kc);
    outline: 1px solid var(--kc);
    outline-offset: 3px;
    font-family: 'Fraunces', serif;
    font-weight: 900;
    transform: rotate(-8deg);
    white-space: nowrap;
    align-self: center;
    flex: none;
  }
  .vst.s {
    font-size: 24px;
    line-height: 1;
    padding: 3px 8px;
    margin-top: 7px;
    outline-offset: 2px;
    border-width: 2px;
  }
  .vst.m {
    font-size: 18px;
    letter-spacing: 1px;
    padding: 6px 10px;
    margin: 18px 0 14px;
  }
  .vst.l {
    font-size: 30px;
    letter-spacing: 2px;
    padding: 9px 18px;
    margin: 22px 0 18px;
  }
  .vunit {
    font: 700 14px/1 'Source Sans 3', sans-serif;
    color: #5e4c3b;
    margin-top: auto;
    padding-bottom: 3px;
  }
  .vparty {
    font: 700 16px/1.2 'Source Sans 3', sans-serif;
  }
  .vterms {
    font: 500 17px/1.35 'Fraunces', serif;
    text-align: center;
    padding: 0 18px;
  }
  .vleft {
    font: 700 15px/1 'Source Sans 3', sans-serif;
    color: var(--kc);
    margin-top: 10px;
    text-align: center;
  }
  .punch {
    display: flex;
    gap: 7px;
    justify-content: center;
    margin-top: 10px;
  }
  .punch span {
    width: 15px;
    height: 15px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 2px var(--kc);
  }
  .punch span.used {
    background: #3b2619;
    box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.6);
  }
  .std .punch span {
    width: 13px;
    height: 13px;
  }
  .vfoot {
    margin-top: auto;
    display: flex;
    justify-content: space-around;
    border-top: 1.5px dashed var(--kc);
    padding-top: 12px;
    margin-left: 6px;
    margin-right: 6px;
  }
  .vfoot > div {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }
  .vfl {
    font: 700 14px/1 'Source Sans 3', sans-serif;
    letter-spacing: 2px;
    color: #5e4c3b;
  }
  .vfn {
    font: 800 20px/1 'Fraunces', serif;
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .vfn i {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    display: inline-block;
    box-shadow: 0 0 0 1.5px #2b2119;
  }
</style>
