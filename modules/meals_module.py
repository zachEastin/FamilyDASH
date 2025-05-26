import os
import json
from pathlib import Path
from flask import Blueprint, Response, request, jsonify
from dotenv import load_dotenv
import requests
from datetime import datetime
import uuid

load_dotenv()
SPOONACULAR_API_KEY = os.getenv("SPOONACULAR_API_KEY")

meals_bp = Blueprint("meals", __name__, url_prefix="/api/meals")
recipes_bp = Blueprint("recipes", __name__, url_prefix="/api/recipes")
mealslot_bp = Blueprint("mealslot", __name__, url_prefix="/api/mealslot")

DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)
MEALS_FILE = DATA_DIR / "meals_data.json"
RECIPES_FILE = DATA_DIR / "recipes.json"

if not MEALS_FILE.exists():
    with open(MEALS_FILE, "w") as f:
        json.dump({}, f)
if not RECIPES_FILE.exists():
    with open(RECIPES_FILE, "w") as f:
        json.dump({}, f)


def load_meals():
    with open(MEALS_FILE, "r") as f:
        return json.load(f)


def save_meals(data):
    with open(MEALS_FILE, "w") as f:
        json.dump(data, f, indent=2)


def load_recipes():
    with open(RECIPES_FILE, "r") as f:
        return json.load(f)


def save_recipes(data):
    with open(RECIPES_FILE, "w") as f:
        json.dump(data, f, indent=2)


@meals_bp.route("/data", methods=["GET"])
def get_meals():
    return jsonify(load_meals())


@meals_bp.route("/update", methods=["POST"])
def update_meal():
    req = request.get_json()
    month = req.get("month")
    date = req.get("date")
    meal_type = req.get("mealType")
    recipe_uuid = req.get("recipe_uuid")
    servings = req.get("servings", 0)
    if not (month and date and meal_type and recipe_uuid):
        return jsonify({"error": "Missing fields"}), 400
    data = load_meals()
    data.setdefault(month, {})
    data[month].setdefault(date, {})
    data[month][date][meal_type] = {"recipe_uuid": recipe_uuid, "servings": servings}
    save_meals(data)
    return jsonify({"status": "ok"})


@meals_bp.route("/today", methods=["GET"])
def get_todays_meals():
    today_str = datetime.now().strftime("%Y-%m-%d")
    month_key = datetime.now().strftime("%Y-%m")
    data = load_meals()
    todays_data = data.get(month_key, {}).get(today_str, {})
    return jsonify({
        "breakfast": todays_data.get("breakfast"),
        "lunch": todays_data.get("lunch"),
        "dinner": todays_data.get("dinner"),
    })


@meals_bp.route("/shopping-list/today", methods=["GET"])
def get_todays_shopping_list():
    today_str = datetime.now().strftime("%Y-%m-%d")
    month_key = datetime.now().strftime("%Y-%m")
    data = load_meals()
    recipes = load_recipes()
    aggregated = {}
    todays_meals = data.get(month_key, {}).get(today_str, {})
    for meal in todays_meals.values():
        if isinstance(meal, dict):
            r_uuid = meal.get("recipe_uuid")
            servings = meal.get("servings", 1)
            recipe = recipes.get(r_uuid)
            if not recipe:
                continue
            default = recipe.get("default_servings", 1) or 1
            factor = servings / default
            for ing in recipe.get("ingredients", []):
                item = ing.get("item")
                unit = ing.get("unit")
                qty = ing.get("quantity", 0) * factor
                key = (item, unit)
                aggregated[key] = aggregated.get(key, 0) + qty
    result = [{"item": k[0], "unit": k[1], "quantity": v} for k, v in aggregated.items()]
    return jsonify(result)


@meals_bp.route("/add-recipe", methods=["POST"])
def add_recipe_to_meal():
    req = request.get_json()
    date_str = req.get("date")
    meal_type = req.get("mealType")
    recipe = req.get("recipe")
    servings = req.get("servings")
    if not (date_str and meal_type and recipe and isinstance(recipe, dict)):
        return jsonify({"error": "Missing or invalid fields"}), 400
    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        month_key = date_obj.strftime("%Y-%m")
        day_key = date_obj.strftime("%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
    r_uuid = str(uuid.uuid4())
    recipe_obj = {
        "uuid": r_uuid,
        "title": recipe.get("title"),
        "ingredients": recipe.get("ingredients", []),
        "tags": recipe.get("tags", []),
        "isFavorite": recipe.get("isFavorite", False),
        "source": recipe.get("source", "local"),
        "default_servings": recipe.get("default_servings", servings or 1),
    }
    recipes = load_recipes()
    recipes[r_uuid] = recipe_obj
    save_recipes(recipes)
    if servings is None:
        servings = recipe_obj.get("default_servings", 1)
    data = load_meals()
    data.setdefault(month_key, {})
    data[month_key].setdefault(day_key, {})
    data[month_key][day_key][meal_type] = {"recipe_uuid": r_uuid, "servings": servings}
    save_meals(data)
    return jsonify({"status": "ok", "recipe_uuid": r_uuid})


@meals_bp.route("/favorites/full", methods=["GET"])
def get_full_favorites():
    recipes = load_recipes()
    favorites = [r for r in recipes.values() if r.get("isFavorite")]
    return jsonify(favorites)


@meals_bp.route("/favorites", methods=["GET"])
def get_favorites() -> Response:
    recipes = load_recipes()
    favorite_recipes: list[tuple[str, str]] = [(r.get("uuid"), r.get("title")) for r in recipes.values() if r.get("isFavorite")]
    return jsonify(sorted(favorite_recipes))


@meals_bp.route("/shopping-list", methods=["GET"])
def get_shopping_list():
    data = load_meals()
    recipes = load_recipes()
    aggregated = {}
    start = request.args.get("start")
    end = request.args.get("end")
    date_filter = None
    if start and end:
        try:
            start_dt = datetime.strptime(start, "%Y-%m-%d")
            end_dt = datetime.strptime(end, "%Y-%m-%d")
            date_filter = (start_dt, end_dt)
        except Exception:
            date_filter = None
    for month_key, month in data.items():
        for day_key, day in month.items():
            if date_filter:
                try:
                    day_dt = datetime.strptime(day_key, "%Y-%m-%d")
                except Exception:
                    continue
                if not (date_filter[0] <= day_dt <= date_filter[1]):
                    continue
            for meal in day.values():
                if isinstance(meal, dict):
                    r_uuid = meal.get("recipe_uuid")
                    servings = meal.get("servings", 1)
                    recipe = recipes.get(r_uuid)
                    if not recipe:
                        continue
                    default = recipe.get("default_servings", 1) or 1
                    factor = servings / default
                    for ing in recipe.get("ingredients", []):
                        item = ing.get("item")
                        unit = ing.get("unit")
                        qty = ing.get("quantity", 0) * factor
                        key = (item, unit)
                        aggregated[key] = aggregated.get(key, 0) + qty
    result = [{"item": k[0], "unit": k[1], "quantity": v} for k, v in aggregated.items()]
    return jsonify(result)


@meals_bp.route("/search", methods=["GET"])
def search_recipes():
    query = request.args.get("query", "")
    if not query or not SPOONACULAR_API_KEY:
        return jsonify({"results": []})
    url = "https://api.spoonacular.com/recipes/complexSearch"
    params = {
        "query": query,
        "apiKey": SPOONACULAR_API_KEY,
        "number": 10,
    }
    resp = requests.get(url, params=params)
    try:
        return jsonify(resp.json())
    except Exception:
        return jsonify({"results": []})


@meals_bp.route("/recipe", methods=["GET"])
def get_recipe_details():
    recipe_id = request.args.get("id")
    if not recipe_id or not SPOONACULAR_API_KEY:
        return jsonify({"error": "Missing id or API key"}), 400
    url = f"https://api.spoonacular.com/recipes/{recipe_id}/information"
    params = {"apiKey": SPOONACULAR_API_KEY}
    try:
        resp = requests.get(url, params=params)
        data = resp.json()
        title = data.get("title", "")
        ingredients = [
            i.get("originalString") or i.get("original") or i.get("name", "")
            for i in data.get("extendedIngredients", [])
        ]
        tags = list(set(data.get("dishTypes", []) + data.get("diets", [])))
        recipe_obj = {
            "title": title,
            "ingredients": ingredients,
            "tags": tags,
            "source": "spoonacular",
        }
        return jsonify(recipe_obj)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@recipes_bp.route("", methods=["GET"])
def list_recipes():
    return jsonify(list(load_recipes().values()))


@recipes_bp.route("/<recipe_uuid>", methods=["GET"])
def get_recipe(recipe_uuid):
    recipe = load_recipes().get(recipe_uuid)
    if not recipe:
        return jsonify({"error": "not found"}), 404
    return jsonify(recipe)


@recipes_bp.route("/add", methods=["POST"])
def add_recipe():
    data = request.get_json() or {}
    r_uuid = str(uuid.uuid4())
    recipe_obj = {
        "uuid": r_uuid,
        "title": data.get("title"),
        "ingredients": data.get("ingredients", []),
        "tags": data.get("tags", []),
        "isFavorite": data.get("isFavorite", False),
        "source": data.get("source", "local"),
        "default_servings": data.get("default_servings", 1),
    }
    recipes = load_recipes()
    recipes[r_uuid] = recipe_obj
    save_recipes(recipes)
    return jsonify(recipe_obj), 201


@recipes_bp.route("/update", methods=["POST"])
def update_recipe():
    data = request.get_json() or {}
    r_uuid = data.get("uuid")
    if not r_uuid:
        return jsonify({"error": "uuid required"}), 400
    recipes = load_recipes()
    if r_uuid not in recipes:
        return jsonify({"error": "not found"}), 404
    recipes[r_uuid].update({k: v for k, v in data.items() if k != "uuid"})
    save_recipes(recipes)
    return jsonify({"status": "ok"})


@recipes_bp.route("/delete", methods=["POST"])
def delete_recipe():
    data = request.get_json() or {}
    r_uuid = data.get("uuid")
    if not r_uuid:
        return jsonify({"error": "uuid required"}), 400
    recipes = load_recipes()
    if r_uuid in recipes:
        recipes.pop(r_uuid)
        save_recipes(recipes)
    return jsonify({"status": "ok"})


@mealslot_bp.route("/<slot_id>", methods=["DELETE"])
def delete_meal_slot(slot_id):
    """Remove the recipe from the specified meal slot."""
    try:
        date_str, meal_type = slot_id.split("|", 1)
    except ValueError:
        return jsonify({"error": "invalid slot id"}), 400
    month_key = date_str[:7]
    data = load_meals()
    day = data.get(month_key, {}).get(date_str, {})
    if meal_type in day:
        day.pop(meal_type)
        if not day:
            data.get(month_key, {}).pop(date_str, None)
        save_meals(data)
    return jsonify({"status": "ok"})


@mealslot_bp.route("/restore", methods=["POST"])
def restore_meal_slot():
    """Restore a previously removed recipe to a meal slot."""
    req = request.get_json() or {}
    slot_id = req.get("slot_id")
    recipe = req.get("recipe")
    if not slot_id or not isinstance(recipe, dict):
        return jsonify({"error": "missing fields"}), 400
    try:
        date_str, meal_type = slot_id.split("|", 1)
    except ValueError:
        return jsonify({"error": "invalid slot id"}), 400
    month_key = date_str[:7]
    data = load_meals()
    data.setdefault(month_key, {}).setdefault(date_str, {})[meal_type] = recipe
    save_meals(data)
    return jsonify({"status": "ok"})
