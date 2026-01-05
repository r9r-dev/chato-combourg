#!/usr/bin/env python3
"""Generate card_scoring.json from rules.py factories and functions.

This script analyzes rules.py and generates a JSON file with structured
scoring rules for each card (001-092).
"""

import json
import re
from pathlib import Path
from typing import Any


# Complex rules with structured data
COMPLEX_RULES: dict[str, dict[str, Any]] = {
    "004": {
        "type": "no_feature_on_board",
        "feature": "price_reduction",
        "score": 8,
    },
    "010": {
        "type": "unique_values_on_board",
        "multiplier": 3,
    },
    "015": {
        "type": "cards_with_shield_count",
        "shield_count": 1,
        "multiplier": 2,
    },
    "016": {
        "type": "category_pairs",
        "categories": ["castle", "village"],
        "multiplier": 3,
    },
    "017": {
        "type": "keys_owned",
        "multiplier": 1,
    },
    "020": {
        "type": "total_coins_on_cards",
        "multiplier": 1,
    },
    "027": {
        "type": "shield_sets_on_board",
        "set_size": 3,
        "any_color": True,
        "multiplier": 6,
    },
    "034": {
        "type": "sum_costs_in_row",
    },
    "038": {
        "type": "missing_colors_on_board",
        "multiplier": 6,
    },
    "056": {
        "type": "no_flipped_cards",
        "score": 12,
    },
    "057": {
        "type": "cards_with_shield_count",
        "shield_count": 2,
        "multiplier": 2,
    },
    "066": {
        "type": "keys_owned",
        "multiplier": 1,
    },
    "069": {
        "type": "category_sets",
        "category": "village",
        "set_size": 3,
        "multiplier": 7,
    },
    "077": {
        "type": "sum_costs_in_col",
    },
    "078": {
        "type": "category_count",
        "category": "village",
        "multiplier": 1,
    },
    "079": {
        "type": "no_feature_on_board",
        "feature": "coin_purse",
        "score": 10,
    },
    "082": {
        "type": "has_flipped_cards",
        "score": 8,
    },
    "084": {
        "type": "category_count",
        "category": "castle",
        "multiplier": 1,
    },
    "085": {
        "type": "position",
        "position": "border",
        "score": 3,
    },
    "087": {
        "type": "position",
        "position": "corner",
        "score": 4,
    },
}


def parse_factory_call(line: str) -> tuple[str, dict[str, Any]] | None:
    """Parse a factory call line and return (card_id, rule_data)."""

    # Pattern: rule_XXX = make_XXX(...)
    match = re.match(r'rule_(\d{3})\s*=\s*(\w+)\((.*)\)', line.strip())
    if not match:
        return None

    card_id = match.group(1)
    factory_name = match.group(2)
    args_str = match.group(3)

    # Parse arguments - handle lists like ["blue", "green", "orange"]
    args_str = args_str.replace('"', "'")

    try:
        if factory_name == "make_shields_in_col_rule":
            # make_shields_in_col_rule("blue", 4)
            m = re.match(r"'(\w+)',\s*(\d+)", args_str)
            if m:
                color, mult = m.groups()
                return card_id, {
                    "type": "shields_in_col",
                    "color": color,
                    "multiplier": int(mult),
                }

        elif factory_name == "make_shields_in_row_rule":
            m = re.match(r"'(\w+)',\s*(\d+)", args_str)
            if m:
                color, mult = m.groups()
                return card_id, {
                    "type": "shields_in_row",
                    "color": color,
                    "multiplier": int(mult),
                }

        elif factory_name == "make_shields_in_row_and_col_rule":
            m = re.match(r"'(\w+)',\s*(\d+)", args_str)
            if m:
                color, mult = m.groups()
                return card_id, {
                    "type": "shields_in_row_and_col",
                    "color": color,
                    "multiplier": int(mult),
                }

        elif factory_name == "make_position_rule":
            m = re.match(r"'(\w+)',\s*(\d+)", args_str)
            if m:
                pos, score = m.groups()
                return card_id, {
                    "type": "position",
                    "position": pos,
                    "score": int(score),
                }

        elif factory_name == "make_pairs_rule":
            m = re.match(r"'(\w+)',\s*'(\w+)',\s*(\d+)", args_str)
            if m:
                c1, c2, mult = m.groups()
                return card_id, {
                    "type": "shield_pairs",
                    "colors": [c1, c2],
                    "multiplier": int(mult),
                }

        elif factory_name == "make_trios_rule":
            # make_trios_rule(["blue", "green", "orange"], 10)
            m = re.match(r"\[(.*?)\],\s*(\d+)", args_str)
            if m:
                colors_str, mult = m.groups()
                colors = re.findall(r"'(\w+)'", colors_str)
                return card_id, {
                    "type": "shield_trios",
                    "colors": colors,
                    "multiplier": int(mult),
                }

        elif factory_name == "make_no_shield_rule":
            m = re.match(r"'(\w+)',\s*(\d+)", args_str)
            if m:
                color, score = m.groups()
                return card_id, {
                    "type": "no_shield_color",
                    "color": color,
                    "score": int(score),
                }

        elif factory_name == "make_coins_on_card_rule":
            m = re.match(r"(\d+),\s*(\d+)", args_str)
            if m:
                max_coins, mult = m.groups()
                return card_id, {
                    "type": "coins_on_card",
                    "max_coins": int(max_coins),
                    "multiplier": int(mult),
                }

        elif factory_name == "make_threshold_rule":
            m = re.match(r"'(\w+)',\s*'(\w+)',\s*(\d+),\s*(\d+)", args_str)
            if m:
                color, scope, threshold, score = m.groups()
                return card_id, {
                    "type": "shield_threshold",
                    "color": color,
                    "scope": scope,  # "row", "col", or "board"
                    "threshold": int(threshold),
                    "score": int(score),
                }

        elif factory_name == "make_category_count_rule":
            m = re.match(r"'(\w+)',\s*(\d+)", args_str)
            if m:
                category, mult = m.groups()
                return card_id, {
                    "type": "category_count",
                    "category": category,
                    "multiplier": int(mult),
                }

        elif factory_name == "make_unique_colors_rule":
            m = re.match(r"'(\w+)',\s*(\d+)", args_str)
            if m:
                scope, mult = m.groups()
                return card_id, {
                    "type": "unique_colors",
                    "scope": scope,  # "row", "col", or "board"
                    "multiplier": int(mult),
                }

        elif factory_name == "make_feature_count_rule":
            m = re.match(r"'(\w+)',\s*(\d+)", args_str)
            if m:
                feature, mult = m.groups()
                return card_id, {
                    "type": "feature_count",
                    "feature": feature,  # "price_reduction", "lock", "coin_purse"
                    "multiplier": int(mult),
                }

        elif factory_name == "make_exact_value_rule":
            m = re.match(r"(\d+),\s*(\d+)", args_str)
            if m:
                value, mult = m.groups()
                return card_id, {
                    "type": "exact_value_count",
                    "value": int(value),
                    "multiplier": int(mult),
                }

        elif factory_name == "make_min_value_rule":
            m = re.match(r"(\d+),\s*(\d+)", args_str)
            if m:
                min_val, mult = m.groups()
                return card_id, {
                    "type": "min_value_count",
                    "min_value": int(min_val),
                    "multiplier": int(mult),
                }

        elif factory_name == "make_flipped_card_rule":
            return card_id, {
                "type": "flipped_card",
                "score": 0,
            }

    except Exception as e:
        print(f"Error parsing {line}: {e}")

    return None


def main():
    """Generate card_scoring.json from rules.py."""

    # Read rules.py
    rules_path = Path(__file__).parent.parent / "app" / "services" / "calculator" / "rules.py"
    with open(rules_path, "r") as f:
        content = f.read()

    # Parse factory calls
    scoring_rules: dict[str, dict[str, Any]] = {}

    for line in content.split("\n"):
        result = parse_factory_call(line)
        if result:
            card_id, rule_data = result
            scoring_rules[card_id] = rule_data

    # Add complex rules
    for card_id, rule_data in COMPLEX_RULES.items():
        scoring_rules[card_id] = rule_data

    # Sort by card ID
    scoring_rules = dict(sorted(scoring_rules.items()))

    # Verify we have all 92 cards
    missing = []
    for i in range(1, 93):
        card_id = f"{i:03d}"
        if card_id not in scoring_rules:
            missing.append(card_id)

    if missing:
        print(f"Warning: Missing rules for cards: {missing}")

    # Write output
    output_path = Path(__file__).parent.parent / "cards" / "card_scoring.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(scoring_rules, f, indent=2, ensure_ascii=False)

    print(f"Generated {output_path}")
    print(f"Total rules: {len(scoring_rules)}")

    # Print rule type statistics
    type_counts: dict[str, int] = {}
    for rule in scoring_rules.values():
        rule_type = rule.get("type", "unknown")
        type_counts[rule_type] = type_counts.get(rule_type, 0) + 1

    print("\nRule types:")
    for rule_type, count in sorted(type_counts.items()):
        print(f"  {rule_type}: {count}")


if __name__ == "__main__":
    main()
