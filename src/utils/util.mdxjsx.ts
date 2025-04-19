import type { Program } from "estree";
import styleToObject from "style-to-js";
import { valueToEstree } from "estree-util-value-to-estree";
import { stringify as join } from "space-separated-tokens";
import type {
  MdxJsxAttribute,
  MdxJsxAttributeValueExpression,
  MdxJsxExpressionAttribute,
} from "mdast-util-mdx-jsx";

export function updateOrAddMdxAttribute(
  attributes: Array<MdxJsxAttribute | MdxJsxExpressionAttribute>,
  name: string,
  value: MdxJsxAttributeValueExpression | string | number | boolean | null | undefined,
): void {
  const existingAttribute = attributes.find(
    (attr): attr is MdxJsxAttribute => attr.type === "mdxJsxAttribute" && attr.name === name,
  );

  /* v8 ignore next 5 */
  if (value === undefined) {
    if (existingAttribute) attributes.splice(attributes.indexOf(existingAttribute), 1);

    return;
  }

  /* v8 ignore next 9 */
  if (value === null) {
    if (existingAttribute) {
      existingAttribute.value = null;
    } else {
      attributes.push({ type: "mdxJsxAttribute", name, value: null });
    }

    return;
  }

  const isExpression = typeof value === "object";
  const newValue = isExpression ? value : String(value);

  if (existingAttribute) {
    if (name === "className" && typeof existingAttribute.value === "string") {
      const currentClasses = new Set(existingAttribute.value.split(/\s+/).filter(Boolean));
      if (typeof value === "string") currentClasses.add(value);
      existingAttribute.value = join(Array.from(currentClasses));
    } else if (name === "style") {
      if (typeof existingAttribute.value === "object" && typeof value === "object") {
        const expressionStatementExistingAttribute =
          existingAttribute.value?.data?.estree?.body[0];
        const expressionStatementPatch = value.data?.estree?.body[0];
        if (
          expressionStatementExistingAttribute?.type === "ExpressionStatement" &&
          expressionStatementPatch?.type === "ExpressionStatement" &&
          expressionStatementExistingAttribute.expression.type === "ObjectExpression" &&
          expressionStatementPatch.expression.type === "ObjectExpression"
        ) {
          expressionStatementExistingAttribute.expression.properties.push(
            ...expressionStatementPatch.expression.properties,
          );
        }
      }
    } else {
      existingAttribute.value = newValue;
    }
  } else {
    attributes.push({ type: "mdxJsxAttribute", name, value: newValue });
  }
}

function program(body: Program["body"]): Program {
  return {
    type: "Program",
    body: body,
    sourceType: "module",
    comments: [],
  };
}

export function composeAttributeValueExpressionLiteral(
  value: string | number | boolean,
): MdxJsxAttributeValueExpression {
  return {
    type: "mdxJsxAttributeValueExpression",
    value: JSON.stringify(value),
    data: {
      estree: program([
        {
          type: "ExpressionStatement",
          expression: {
            type: "Literal",
            value: value,
            raw: JSON.stringify(value),
          },
        },
      ]),
    },
  };
}

function toObjectLiteral(obj: Record<string, unknown>): string {
  return `{${Object.entries(obj)
    .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
    .join(",")}}`;
}

export function composeAttributeValueExpressionStyle(
  value: string,
): MdxJsxAttributeValueExpression {
  return {
    type: "mdxJsxAttributeValueExpression",
    value: toObjectLiteral(styleToObject(value)),
    data: {
      estree: program([
        {
          type: "ExpressionStatement",
          expression: valueToEstree(styleToObject(value)),
        },
      ]),
    },
  };
}
