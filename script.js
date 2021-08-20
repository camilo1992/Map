'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;
  edit = false;
  e;
  mapEvent;

  constructor(coords, distance, duration) {
    // this.date = ...
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    // this.type = 'cycling';
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

///////////////////////////////////////
// APPLICATION ARCHITECTURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const deleteAllBtn = document.querySelector(`.btn`);
const sortBtn = document.querySelector(`.fa-exchange`);

class App {
  #map;
  #mapZoomLevel = 15;
  #mapEvent;
  workouts = [];
  #markers = [];
  sort = false;

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Create Delete all button when there is a workOut sotored in the local.
    this._RenderDeleteAllBtn();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    deleteAllBtn.addEventListener(`click`, this._deleteAll.bind(this));
    sortBtn.addEventListener(`click`, this.sortResults.bind(this));
  }

  _deleteAll() {
    const ans = prompt(`Do you want to delete everything ? Yes / no`)
      .trim()
      .toLowerCase();

    if (ans === `no`) return;

    // 1.Delete elements form list
    const all = document.querySelectorAll(`.workout`);
    all.forEach(el => el.remove());

    // Delete data from local storage
    //2. Retrieve dat form local storage and parase it from JSON to JS
    const data = JSON.parse(localStorage.getItem(`workouts`));

    // Delete markers from the map
    this.#markers.forEach(marker => marker.remove());

    //2.1. Delete every element in the array retrieved.
    data.splice(0, data.length);
    this.workouts = data;

    //2.2. Update the local storage.
    this._setLocalStorage();

    //  We need to use the clear method in order to clear any element sotred in the local storage.
    localStorage.clear();

    // Hide Delete button
    deleteAllBtn.style.display = `none`;
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    // console.log(`https://www.google.pt/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    this.mapEvent = this.#mapEvent;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _RenderDeleteAllBtn() {
    if (localStorage.length === 0) return;
    deleteAllBtn.style.display = `grid`;
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));

    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    // Define edited workout
    const edited = this.workouts.find(workout => workout.edit);

    e.preventDefault();

    const lng = this.#mapEvent?.latlng.lng || edited.coords[1];
    const lat = this.#mapEvent?.latlng.lat || edited.coords[0];

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // Check if data is valid
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();

    // Create DeleteAllButton
    this._RenderDeleteAllBtn();

    // Set delete edited event

    if (!edited) return;
    this.deleteElement(edited.e);
    this._renderWorkoutMarker(edited);
  }

  _renderWorkoutMarker(workout) {
    const time = new Date();
    const text = `${time.getHours()}.${time.getMinutes()}:${time.getSeconds()}`;

    const marker1 = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .bindTooltip(`${text}`, {
        opacity: 0.9,
        sticky: false,
        permanent: false,
        direction: `auto`,
      })
      .openTooltip()

      .openPopup();

    this.#markers.push(marker1);

    const { lat, lng } = marker1.getLatLng();
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <h2 class="workout__title">${workout.description}</h2>
       <div class="edit-btn" >
       <i class="fa fa-trash-o" style="font-size:20px"></i>
       <i class="fa fa-pencil" style="font-size:20px; padding-left:10px"></i> 
        </div>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
      `;

    form.insertAdjacentHTML('afterend', html);
    deleteAllBtn.classList.display = `grid`;
    this.setTrashEvent();
    this.setEditBtn();
  }

  _moveToPopup(e) {
    // BUGFIX: When we click on a workout before the map has loaded, we get an error. But there is an easy fix:
    if (!this.#map) return;

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;
    this._RenderDeleteAllBtn;

    this.workouts = data;

    this.workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  setTrashEvent() {
    const trash = document.querySelector(`.fa-trash-o`);
    trash.addEventListener(`click`, this.deleteElement.bind(this));
  }

  deleteElement(e) {
    const el = e.target.closest(`.workout`);
    const id = el.dataset.id;
    const data = JSON.parse(localStorage.getItem(`workouts`));
    const idx = data.findIndex(workout => id === workout.id);
    const marker = this.#markers[idx];

    // Remove element from the UI list
    el.remove();

    // Delete lement formt the local storage
    data.splice(idx, 1);

    // Delete workout marker
    this.#markers.splice(idx, 1);
    marker.remove();

    // Update
    this.workouts = data;

    // Store new data into the  local Storage.
    this._setLocalStorage();

    //  Hide delete all btn
    if (data.length === 0) {
      deleteAllBtn.style.display = `none`;
      localStorage.clear();
    }

    // stop event propagation .....
    e.stopPropagation();
  }

  setEditBtn() {
    const edit = document.querySelector(`.fa-pencil`);
    edit.addEventListener(`click`, this.editWourout.bind(this));
  }

  editWourout(e) {
    // identify element
    const el = e.target.closest(`.workout`);
    const work = this.workouts.find(work => work.id === el.dataset.id);
    //  set edit event on the edited element
    work.edit = true;
    work.e = e;
    console.log(work.e);

    // Display form
    form.classList.remove('hidden');
    inputDistance.focus();

    e.stopPropagation();
  }

  sortResults() {
    // There is a variable called sorted -->
    // it works as a states variable in order to help us sort and unsort workouts.

    //Get data
    const workouts = [...this.workouts];
    workouts.sort((a, b) => a.distance - b.distance);
    // Clear workout cotainer
    const curWorkouts = Array.from(document.querySelectorAll(`.workout`));
    curWorkouts.forEach(data => data.remove());
    // Render sorted workouts
    if (!this.sort) {
      this.sort = !this.sort;
      workouts.forEach(workout => this._renderWorkout(workout));
    } else {
      this.workouts.forEach(workout => this._renderWorkout(workout));
      this.sort = !this.sort;
    }
  }
}

const app = new App();
