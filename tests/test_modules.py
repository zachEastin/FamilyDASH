import unittest
import importlib
from unittest import mock
import os
from pathlib import Path
import json
import tempfile


def flask_available():
    return importlib.util.find_spec('flask') is not None


@unittest.skipUnless(flask_available(), 'Flask not installed')
class TimeModuleTests(unittest.TestCase):
    def test_get_time_data(self):
        from flask import Flask
        from modules import time_module

        app = Flask(__name__)
        with app.app_context():
            resp = time_module.get_time()
            data = resp.get_json()
            self.assertEqual(data['status'], 'ok')
            self.assertIn('time', data['data'])
            self.assertIn('ampm', data['data'])


@unittest.skipUnless(flask_available(), 'Flask not installed')
class NetworkModuleTests(unittest.TestCase):
    def test_network_status(self):
        from flask import Flask
        from modules import network_module
        import requests

        app = Flask(__name__)
        with app.app_context(), mock.patch('requests.get') as mget:
            mget.return_value.status_code = 200
            resp = network_module.get_network()
            self.assertEqual(resp.get_json()['data']['network'], 'online')

            mget.side_effect = requests.RequestException()
            resp = network_module.get_network()
            self.assertEqual(resp.get_json()['data']['network'], 'offline')


@unittest.skipUnless(flask_available(), 'Flask not installed')
class SunModuleTests(unittest.TestCase):
    def test_get_sun(self):
        from flask import Flask
        from modules import sun_module

        app = Flask(__name__)
        os.environ['LATITUDE'] = '0'
        os.environ['LONGITUDE'] = '0'
        with app.app_context():
            resp = sun_module.get_sun()
            data = resp.get_json()
            self.assertEqual(data['status'], 'ok')
            self.assertIn('sunrise', data['data'])
            self.assertIn('sunset', data['data'])


@unittest.skipUnless(flask_available(), 'Flask not installed')
class LightingModuleTests(unittest.TestCase):
    def test_get_lighting_stub(self):
        from flask import Flask
        from modules import lighting_module

        app = Flask(__name__)
        with app.app_context(), mock.patch.object(lighting_module, '_IS_LINUX', False):
            resp = lighting_module.get_lighting()
            data = resp.get_json()
            self.assertEqual(data['status'], 'ok')
            self.assertIn('ambient_light', data['data'])


@unittest.skipUnless(flask_available(), 'Flask not installed')
class WeatherModuleTests(unittest.TestCase):
    def test_get_weather_and_forecast(self):
        from flask import Flask
        from modules import weather_module
        import time

        app = Flask(__name__)
        sample = {
            'current': {
                'temp': 10,
                'weather': [{'icon': '01d', 'description': 'clear'}],
                'humidity': 50,
                'wind_speed': 1,
                'wind_deg': 200,
                'uvi': 1,
                'sunrise': 0,
                'sunset': 0,
                'feels_like': 10,
                'pressure': 1012,
                'clouds': 0,
                'dew_point': 5,
            },
            'daily': [{'temp': {'min': 8, 'max': 12}, 'moon_phase': 0.5}],
            'hourly': [{'dt': 1, 'temp': 9, 'weather': [{'icon': '01d', 'description': 'clear'}]}]
        }
        with app.app_context(), mock.patch.dict(weather_module._WEATHER_CACHE, {'onecall': sample, 'onecall_timestamp': time.time()}):
            resp = weather_module.get_weather()
            data = resp.get_json()
            self.assertEqual(data['status'], 'ok')
            self.assertIn('temp', data['data'])

            f_resp = weather_module.get_forecast()
            f_data = f_resp.get_json()
            self.assertEqual(f_data['status'], 'ok')
            self.assertIn('hourly', f_data['data'])
            self.assertIn('daily', f_data['data'])


@unittest.skipUnless(flask_available(), 'Flask not installed')
class MealsModuleTests(unittest.TestCase):
    def setUp(self):
        from modules import meals_module
        self.meals_module = meals_module
        self.tempdir = tempfile.TemporaryDirectory()
        self.orig_file = meals_module.MEALS_FILE
        meals_module.MEALS_FILE = Path(self.tempdir.name) / 'meals.json'
        with open(meals_module.MEALS_FILE, 'w') as f:
            json.dump({}, f)

    def tearDown(self):
        self.meals_module.MEALS_FILE = self.orig_file
        self.tempdir.cleanup()

    def test_update_and_load_meal(self):
        from flask import Flask
        app = Flask(__name__)
        with app.test_request_context(json={
            'month': '2024-01',
            'date': '2024-01-01',
            'mealType': 'breakfast',
            'recipe': 'eggs'
        }):
            resp = self.meals_module.update_meal()
            self.assertEqual(resp.get_json()['status'], 'ok')
        data = self.meals_module.load_meals()
        self.assertEqual(data['2024-01']['2024-01-01']['breakfast'], 'eggs')

    def test_add_recipe_to_meal(self):
        from flask import Flask
        app = Flask(__name__)
        with app.test_request_context(json={
            'date': '2024-01-02',
            'mealType': 'lunch',
            'recipe': {'title': 'salad'}
        }):
            resp = self.meals_module.add_recipe_to_meal()
            self.assertEqual(resp.get_json()['status'], 'ok')
        data = self.meals_module.load_meals()
        self.assertEqual(data['2024-01']['2024-01-02']['lunch']['title'], 'salad')


if __name__ == '__main__':
    unittest.main()
