// @flow

import {
  Application, Graphics,
  TilingSprite, Loader, Texture,
} from 'pixi.js';
import _ from 'lodash';

import type {
  Id, TimelineItem, TimelineCell,
} from 'game/types';
import settings from './settings';

const MAX_ZOOM = settings.windowSize / settings.fieldSize;

type PlayerOption = {
  id: Id,
  color: string,
};

export type DrawOptions = {
  canvasId: string,
  backgroundUrl: string,
  players: PlayerOption[],
  onReady?: () => void,
};

type CanvasCell = Graphics;

class Draw {
  app: Application;

  loader: Loader;

  players: {[Id]: PlayerOption};

  cells: {[string]: CanvasCell} = {};

  followId: ?Id;

  backgroundUrl: ?string;

  onReady: ?() => void;

  onUpdate: ?(step: number) => void;

  constructor(options: DrawOptions) {
    this.onReady = options.onReady;
    this.players = _.keyBy(options.players, 'id');
    this.backgroundUrl = options.backgroundUrl;
    this.initApp(options.canvasId);
  }

  initApp(id: string) {
    this.app = new Application({
      view: document.getElementById(id),
      width: settings.windowSize,
      height: settings.windowSize,
      antialias: true,
      autoStart: false,
    });

    this.app.ticker.add(() => this.loop && this.loop());
    this.loader = new Loader();
    this.backgroundUrl && this.loader.add(this.backgroundUrl);
    this.loader.load(this.setup);
  }

  // eslint-disable-next-line class-methods-use-this
  loop() {}

  setup = (loader: any, resources: {[string]: any}) => {
    if (this.backgroundUrl && resources[this.backgroundUrl]) {
      this.setBackground(resources[this.backgroundUrl].texture);
    }
    this.app.render();

    this.onReady && this.onReady();
  }

  setBackground(texture: Texture) {
    const tilingSprite = new TilingSprite(texture, settings.fieldSize, settings.fieldSize);
    this.app.stage.addChild(tilingSprite);
    this.app.stage.setChildIndex(tilingSprite, 0);
  }

  clearScene() {
    this.app.stage.removeChildren();
  }

  initGraphicObjects(timelineItem: TimelineItem): void {
    this.cells = _(timelineItem.players)
      .map('cells')
      .flatten()
      .map(cell => this.createCell(cell))
      .keyBy('id')
      .value();

    this.app.stage.addChild(..._.values(this.cells));
  }

  createCell(cell: TimelineCell) {
    const {color} = this.players[cell.playerId];
    const circle = new Graphics();

    circle.beginFill(parseInt(color.replace(/^#/, ''), 16));
    circle.drawCircle(0, 0, 1);
    circle.endFill();
    circle.x = cell.pos.x;
    circle.y = cell.pos.y;
    circle.scale.set(cell.size);
    circle.id = cell.id;

    return circle;
  }

  start() {
    this.app.start();
  }

  stop() {
    this.app.stop();
  }

  setFollow(id: ?Id) {
    this.followId = id;
  }

  update(item: TimelineItem) {
    const deadPlayers = [];
    const alivePlayers = [];
    const timelinePlayersById = _.keyBy(item.players, 'id');
    const gameCells = _(item.players)
      .map('cells')
      .flatten()
      .keyBy('id')
      .value();
    const newCellsIds = _.difference(_.keys(gameCells), _.keys(this.cells));
    const newCells = _.map(newCellsIds, id => this.createCell(gameCells[id]));
    _.isEmpty(newCells) || this.app.stage.addChild(...newCells);

    this.cells = {
      ...this.cells,
      ..._.keyBy(newCells, 'id'),
    };

    _.forEach(this.cells, (canvasCell) => {
      const gameCell = gameCells[canvasCell.id];

      if (gameCell) {
        /* eslint-disable no-param-reassign */
        canvasCell.x = gameCell.pos.x;
        canvasCell.y = gameCell.pos.y;
        /* eslint-enable no-param-reassign */
        canvasCell.scale.set(gameCell.size);

        alivePlayers.push(canvasCell.id);
      } else {
        deadPlayers.push(canvasCell.id);
      }
    });

    this.app.stage.removeChild(..._(this.cells).pick(deadPlayers).values().value());
    this.cells = _.pick(this.cells, alivePlayers);

    if (this.followId && timelinePlayersById[this.followId]) {
      this.viewportTo(timelinePlayersById[this.followId].cells[0]);
    } else {
      this.viewportTo(null);
    }

    this.app.render();
  }

  viewportTo(cell: ?TimelineCell) {
    if (cell) {
      const scale = Math.max(settings.windowSize / (cell.size * 2 * 20), MAX_ZOOM);

      this.app.stage.scale.set(scale);
      this.app.stage.x = -cell.pos.x * scale + settings.windowSize / 2;
      this.app.stage.y = -cell.pos.y * scale + settings.windowSize / 2;
    } else {
      this.app.stage.scale.set(MAX_ZOOM);
      this.app.stage.x = 0;
      this.app.stage.y = 0;
    }
  }
}

export default Draw;