const DATA_URL = "./data/topology.json";
const DEFAULT_EDGE_COLOR = { color: "#81e5d2", highlight: "#4bc7b4" };
const PortholeEventType = Object.freeze({
  BUTTON_CLICKED: Object.freeze({ code: 0 }),
  TEXT_SUBMITTED: Object.freeze({ code: 1 }),
  VALUE_CHANGED: Object.freeze({ code: 2 }),
  ITEM_SELECTED: Object.freeze({ code: 3 })
});

const networkContainer = document.getElementById("network");
const resetButton = document.getElementById("resetButton");
const nodeDialog = document.getElementById("nodeDialog");
const nodeDialogTitle = document.getElementById("nodeDialogTitle");
const nodeDetails = document.getElementById("nodeDetails");
const closeDialogButton = document.getElementById("closeDialogButton");
const nodeActionButton = document.getElementById("nodeActionButton");

let network;
let nodeOrder = [];
let nodeMap = new Map();
let activeNode;

const GROUP_STYLES = {
  gateway: {
    shape: "image",
    image: "./assets/icons/gateway.svg"
  },
  service: {
    shape: "image",
    image: "./assets/icons/service.svg"
  },
  database: {
    shape: "image",
    image: "./assets/icons/database.svg"
  },
  client: {
    shape: "image",
    image: "./assets/icons/client.svg"
  },
  iox2: {
    shape: "image",
    image: "./assets/icons/iox-2-front.svg",
    size: 16
  },
  iox4: {
    shape: "image",
    image: "./assets/icons/iox-4-front.svg",
    size: 16
  },
  ace: {
    shape: "image",
    image: "./assets/icons/ace-02-front.svg",
    size: 16
  }
};

async function loadTopology() {
  // Browsers block fetch() for file:// URLs. Static hosts still load the JSON.
  if (window.location.protocol === "file:") {
    if (!window.LOCAL_TOPOLOGY) {
      throw new Error("File dati locale non disponibile.");
    }

    return window.LOCAL_TOPOLOGY;
  }

  const response = await fetch(DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Impossibile leggere ${DATA_URL} (${response.status})`);
  }

  return response.json();
}

function getCircularPosition(index, total) {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const radius = 480;

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
  };
}

function createNetwork(topology) {
  nodeOrder = topology.nodes.map((node) => node.id);
  nodeMap = new Map(topology.nodes.map((node) => [String(node.id), node]));

  const nodes = new vis.DataSet(
    topology.nodes.map((node, index) => ({
      ...node,
      ...getCircularPosition(index, topology.nodes.length),
      ...(GROUP_STYLES[node.group] ?? {})
    }))
  );

  const edges = new vis.DataSet(
    topology.edges.map((edge, index) => ({
      id: edge.id ?? `edge-${index}`,
      arrows: "to, from",
      smooth: false,
      color: edge.color ?? DEFAULT_EDGE_COLOR,
      ...edge,
      label: ""
    }))
  );

  const data = { nodes, edges };
  const options = {
    autoResize: true,
    interaction: {
      hover: true,
      navigationButtons: true,
      keyboard: true,
      dragNodes: true
    },
    layout: {
      improvedLayout: false
    },
    physics: false,
    nodes: {
      borderWidth: 2,
      shadow: true,
      margin: 14,
      shapeProperties: {
        useImageSize: false
      }
    },
    edges: {
      width: 2,
      shadow: false
    }
  };

  if (network) {
    network.destroy();
  }

  network = new vis.Network(networkContainer, data, options);
  network.fit({ animation: true });
  network.on("doubleClick", ({ nodes: selectedNodes }) => {
    const node = nodeMap.get(String(selectedNodes[0]));

    if (node) {
      showNodeDialog(node);
    }
  });
}

function showNodeDialog(node) {
  activeNode = node;
  nodeDialogTitle.textContent = node.label ?? node.id;
  nodeDetails.replaceChildren();

  Object.entries(node.details ?? {}).forEach(([key, value]) => {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = key;
    description.textContent = String(value);
    nodeDetails.append(term, description);
  });

  nodeDialog.showModal();
}

function resetLayout() {
  if (!network) {
    return;
  }

  nodeOrder.forEach((id, index) => {
    const position = getCircularPosition(index, nodeOrder.length);
    network.moveNode(id, position.x, position.y);
  });
  network.fit({ animation: true });
}

async function init() {
  try {
    const topology = await loadTopology();
    createNetwork(topology);
  } catch (error) {
    console.error(error);
    networkContainer.innerHTML = `
      <div style="padding: 24px; color: #8d3f19;">
        <strong>Errore caricamento dati:</strong><br>${error.message}
      </div>
    `;
  }
}

resetButton.addEventListener("click", resetLayout);
closeDialogButton.addEventListener("click", () => nodeDialog.close());
nodeActionButton.addEventListener("click", () => {
  if (activeNode && window.globconBridge?.emit) {
    window.globconBridge.emit(PortholeEventType.BUTTON_CLICKED.code, "OPEN_NODE_DETAILS", String(activeNode.id));
  }
});
init();
