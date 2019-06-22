import React from "react";
import PropTypes from "prop-types";
import ReactDOM from "react-dom";

// Добавил combine (спасибо habrhabr)
const combineReducers = reducersMap => {
  return (state, action) => {
    const nextState = {};
    Object.entries(reducersMap).forEach(([key, reducer]) => {
      nextState[key] = reducer(state[key], action);
    });
    return nextState;
  };
};

// Default args
const createStore = (reducer, initialState = {}) => {
  let currentState = initialState;
  const listeners = [];

  const getState = () => currentState;
  const dispatch = action => {
    currentState = reducer(currentState, action);
    listeners.forEach(listener => listener());
  };

  const subscribe = listener => listeners.push(listener);

  // Добавил системный event, для инициализации
  dispatch({
    type: "__INITIAL_ACTION__"
  });

  return { getState, dispatch, subscribe };
};

const connect = (mapStateToProps, mapDispatchToProps) => Component => {
  class WrappedComponent extends React.Component {
    render() {
      return (
        <Component
          {...this.props}
          {...mapStateToProps(this.context.store.getState(), this.props)}
          {...mapDispatchToProps(this.context.store.dispatch, this.props)}
        />
      );
    }

    componentDidMount() {
      this.context.store.subscribe(this.handleChange);
    }

    handleChange = () => {
      this.forceUpdate();
    };
  }

  WrappedComponent.contextTypes = {
    store: PropTypes.object
  };

  return WrappedComponent;
};

class Provider extends React.Component {
  getChildContext() {
    return {
      store: this.props.store
    };
  }

  render() {
    return React.Children.only(this.props.children);
  }
}

Provider.childContextTypes = {
  store: PropTypes.object
};

// APP

// actions
const CHANGE_INTERVAL = "CHANGE_INTERVAL";
// action creators
const changeInterval = value => ({
  type: CHANGE_INTERVAL,
  payload: value
});

// reducers
const currentIntervalReducer = (state = 1, action) => {
  switch (action.type) {
    case CHANGE_INTERVAL:
      return (state += action.payload);
    default:
      return state;
  }
};

// # Ошибка: this.props.currentInterval содержит dispatch :D
// # Решение: в connect, нарушен порядок аргументов

// # Ошибка: this.props.currentInterval === undefined
// # Решение комплексное:
//    - проверяю reducer, case default возвращает пустой объект, хотя должен возвращать state
//    - в createStore передаю initialState и изменяем структуру стейта, выделяю отдельный ключ под значение текущего интервала
//    - изменяю mapStateToProps так как state, имеет другую структуру

// # Ошибка: при increment/decrement значния не меняются
// # Решение комплексное:
//    - проверяю reducer, ошибка в case (несмотря на правильно состояние slomux, не происходит обновление в компонентах)
//    - проверяю функцию connect, использован не правильный метод жизненного цикла, не присходит подписка на стор

// # Наводим порядок
//    - данному компоненту, не нужно иметь состояния, переписываем его на stateless
//    - избавляюсь от анонимных функций в onClick
//    - добавляю PropTypes
//    - значение интервала, не может быть отрицательным или 0 (event looop), по этому, добавляю disable кнопки

// После данных манипуляций, IntervalComponent ведет себя предсказуемо :)

const IntervalComponent = ({ changeInterval, currentInterval }) => {
  const incrementInterval = () => changeInterval(1);
  const decrementInterval = () => changeInterval(-1);

  return (
    <div>
      <span>Интервал обновления секундомера: {currentInterval} сек.</span>
      <span>
        <button onClick={decrementInterval} disabled={currentInterval <= 1}>
          -
        </button>
        <button onClick={incrementInterval}>+</button>
      </span>
    </div>
  );
};

IntervalComponent.propTypes = {
  currentInterval: PropTypes.number.isRequired,
  changeInterval: PropTypes.func.isRequired
};

const Interval = connect(
  state => ({
    currentInterval: state.currentInterval
  }),
  dispatch => ({
    changeInterval: value => dispatch(changeInterval(value))
  })
)(IntervalComponent);

// # Ошибка: при нажатии, на кнопки Старт и Стоп, происходит потеря значения this,
// # Решение: - arrow function expression

// # Ошибка: this.props.currentInterval === undefined
// # Решение: изменине mapStateToProps

// # Ошибка: неправильное использование setState
// # Решение: использование prevState, для расчета следующего состояния компонента

// # Ошибка: Множественные ошибки логики в запуске/остановки таймера
// # Решение комплексное:
//    - Вынесение логики "шага" в отдельный метод, неправлиьное использование setState для расчета нового
//      состояния на основе текущего состояния (сет стейт, ассинхроный, необходимо использовать prevState)
//    - Замена setTimeout на setInterval
//    - Значение интервала передается в секундах, setInterval ожидает ms
//    - Необходимо сохранить индентификатор таймера, для его остановки
//    - таймер можно запустить несколько раз

// # Наводим порядок
//    - добавляю PropTypes

// После данных манипуляций, IntervalComponent ведет себя предсказуемо :)

class TimerComponent extends React.Component {
  state = {
    currentTime: 0,
    intervalId: null
  };

  tick = () => {
    this.setState(prevState => ({
      currentTime: prevState.currentTime + this.props.currentInterval
    }));
  };

  handleStart = () => {
    const intervalId = setInterval(
      this.tick,
      this.props.currentInterval * 1000
    );

    this.setState({
      intervalId,
      currentTime: 0
    });
  };

  handleStop = () => {
    clearInterval(this.state.intervalId);

    this.setState({
      intervalId: null
    });
  };

  render() {
    return (
      <div>
        <Interval />
        <div>Секундомер: {this.state.currentTime} сек.</div>
        <div>
          <button onClick={this.handleStart} disabled={this.state.intervalId}>
            Старт
          </button>
          <button onClick={this.handleStop} disabled={!this.state.intervalId}>
            Стоп
          </button>
        </div>
      </div>
    );
  }
}

TimerComponent.propTypes = {
  currentInterval: PropTypes.number.isRequired
};

const Timer = connect(
  state => ({
    currentInterval: state.currentInterval
  }),
  () => {}
)(TimerComponent);

const rootReducer = combineReducers({
  currentInterval: currentIntervalReducer
});

const store = createStore(rootReducer);

ReactDOM.render(
  <Provider store={store}>
    <Timer />
  </Provider>,
  document.getElementById("app")
);
