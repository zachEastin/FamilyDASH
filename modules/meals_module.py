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
    data = load_meals()
    ingredients = []
    for month in data.values():
        for day in month.values():
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
