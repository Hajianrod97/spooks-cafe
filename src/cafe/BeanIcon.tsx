import bean from "../assets/shop/bean.svg";

/** A Boo Bean, the shop's currency. Decorative: the number next to it carries the meaning. */
export function BeanIcon({ size = 20 }: { size?: number }) {
  return <img className="bean-icon" src={bean} width={size} height={size} alt="" />;
}
