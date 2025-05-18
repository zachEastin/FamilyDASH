import os
import json
from pathlib import Path
from flask import Blueprint, request, jsonify
from dotenv import load_dotenv
import requests

# Load environment variables
load_dotenv()
SPOONACULAR_API_KEY = os.getenv("SPOONACULAR_API_KEY")

meals_bp = Blueprint("meals", __name__, url_prefix="/api/meals")

DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)
MEALS_FILE = DATA_DIR / "meals_data.json"

# Ensure the data file exists
if not MEALS_FILE.exists():
    with open(MEALS_FILE, "w") as f:
        json.dump({}, f)

def load_meals():
    with open(MEALS_FILE, "r") as f:
        return json.load(f)

def save_meals(data):
    with open(MEALS_FILE, "w") as f:
        json.dump(data, f, indent=2)

@meals_bp.route("/data", methods=["GET"])
def get_meals():
    data = load_meals()
    return jsonify(data)

@meals_bp.route("/update", methods=["POST"])
def update_meal():
    req = request.get_json()
    month = req.get("month")
    date = req.get("date")
    meal_type = req.get("mealType")
    recipe = req.get("recipe")
    if not (month and date and meal_type and recipe):
        return jsonify({"error": "Missing fields"}), 400
    data = load_meals()
    data.setdefault(month, {})
    data[month].setdefault(date, {})
    data[month][date][meal_type] = recipe
    save_meals(data)
    return jsonify({"status": "ok"})

@meals_bp.route("/favorites", methods=["GET"])
def get_favorites():
    data = load_meals()
    favorites = set()
    for month in data.values():
        for day in month.values():
            for meal in day.values():
                if isinstance(meal, dict) and meal.get("isFavorite"):
                    title = meal.get("title")
                    if title:
                        favorites.add(title)
    return jsonify(sorted(list(favorites)))

@meals_bp.route("/shopping-list", methods=["GET"])
def get_shopping_list():
    from datetime import datetime
    data = load_meals()
    ingredients = []
    start = request.args.get("start")
    end = request.args.get("end")
    date_filter = None
    if start and end:
        try:
            start_dt = datetime.strptime(start, "%Y-%m-%d")
            end_dt = datetime.strptime(end, "%Y-%m-%d")
            print("Start date:", start_dt, "End date:", end_dt)
            date_filter = (start_dt, end_dt)
        except Exception:
            date_filter = None
    for month_key, month in data.items():
        for day_key, day in month.items():
            # day_key is 'YYYY-MM-DD' or similar
            if date_filter:
                try:
                    day_dt = datetime.strptime(day_key, "%Y-%m-%d")
                except Exception:
                    continue
                if not (date_filter[0] <= day_dt <= date_filter[1]):
                    continue
            for meal in day.values():
                if isinstance(meal, dict):
                    ings = meal.get("ingredients")
                    if isinstance(ings, list):
                        ingredients.extend(ings)
    return jsonify(sorted(set(ingredients)))

@meals_bp.route("/search", methods=["GET"])
def search_recipes():
    query = request.args.get("query", "")
    if not query or not SPOONACULAR_API_KEY:
        return jsonify({"results": []})
    url = "https://api.spoonacular.com/recipes/complexSearch"
    params = {
        "query": query,
        "apiKey": SPOONACULAR_API_KEY,
        "number": 10
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
        # Format to local schema
        title = data.get("title", "")
        # Ingredients: use originalString or name
        ingredients = [
            i.get("originalString") or i.get("original") or i.get("name", "")
            for i in data.get("extendedIngredients", [])
        ]
        # Tags: combine dishTypes and diets
        tags = list(set(data.get("dishTypes", []) + data.get("diets", [])))
        recipe_obj = {
            "title": title,
            "ingredients": ingredients,
            "tags": tags,
            "source": "spoonacular"
        }
        return jsonify(recipe_obj)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
