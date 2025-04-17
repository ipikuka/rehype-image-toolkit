import type { Program } from "estree";
import styleToObject from "style-to-js";
import { valueToEstree } from "estree-util-value-to-estree";
import { stringify as join } from "space-separated-tokens";
import type {
  MdxJsxAttribute,
  MdxJsxAttributeValueExpression,
  MdxJsxExpressionAttribute,
} from "mdast-util-mdx-jsx";

import { ensureSemiColon, toObjectLiteral } from "./index.js";

export function updateOrAddMdxAttribute(
  attributes: Array<MdxJsxAttribute | MdxJsxExpressionAttribute>,
  name: string,
  value: MdxJsxAttributeValueExpression | string | number | boolean | null | undefined,
): void {
  const existing = attributes.find(
    (attr): attr is MdxJsxAttribute => attr.type === "mdxJsxAttribute" && attr.name === name,
  );

  if (value === undefined) {
    if (existing) attributes.splice(attributes.indexOf(existing), 1);

    return;
  }

  if (value === null) {
    if (existing) {
      existing.value = null;
    } else {
      attributes.push({ type: "mdxJsxAttribute", name, value: null });
    }

    return;
  }

  const isExpression = typeof value === "object";
  const newValue = isExpression ? value : String(value);

  if (existing) {
    if (name === "class") {
      const current = typeof existing.value === "string" ? existing.value : undefined;
      const currentClasses = new Set(current?.split(/\s+/).filter(Boolean));
      if (typeof value === "string") currentClasses.add(value);
      const merged = join(Array.from(currentClasses));
      existing.value = typeof value === "object" ? value : merged;
    } else if (name === "style") {
      if (typeof existing.value === "string" && typeof value === "string") {
        existing.value = existing.value
          ? ensureSemiColon(existing.value) + ensureSemiColon(value)
          : ensureSemiColon(value);
      } else if (typeof existing.value === "object" && typeof value === "object") {
        const expressionStatementExisting = existing.value?.data?.estree?.body[0];
        const expressionStatementPatch = value.data?.estree?.body[0];
        if (
          expressionStatementExisting?.type === "ExpressionStatement" &&
          expressionStatementPatch?.type === "ExpressionStatement" &&
          expressionStatementExisting.expression.type === "ObjectExpression" &&
          expressionStatementPatch.expression.type === "ObjectExpression"
        ) {
          expressionStatementExisting.expression.properties.push(
            ...expressionStatementPatch.expression.properties,
          );
        }
      }
    } else {
      existing.value = newValue;
    }
  } else {
    attributes.push({ type: "mdxJsxAttribute", name, value: newValue });
  }
}

export function program(body: Program["body"]): Program {
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
