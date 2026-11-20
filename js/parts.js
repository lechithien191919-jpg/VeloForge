const GRID_SIZE = 44;

const PARTS_CATALOG = {
  chassis: {
    id: 'chassis',
    name: 'Khung Thép',
    shortDesc: 'Khung cơ bản, nhẹ & dễ nối',
    color: '#64748b',
    accent: '#94a3b8',
    mass: 1.0,
    hp: 120,
    category: 'structure'
  },
  armor: {
    id: 'armor',
    name: 'Giáp Tăng',
    shortDesc: 'Giáp nặng, chống va đập cực trâu',
    color: '#3f4e4f',
    accent: '#84a98c',
    mass: 2.6,
    hp: 320,
    category: 'structure'
  },
  wheel: {
    id: 'wheel',
    name: 'Bánh Địa Hình',
    shortDesc: 'Có lò xo treo, kéo khỏe leo dốc',
    color: '#1e293b',
    accent: '#38bdf8',
    mass: 1.2,
    hp: 150,
    radius: 24,
    motorTorque: 0.085,
    category: 'mobility'
  },
  thruster: {
    id: 'thruster',
    name: 'Tên Lửa Đẩy',
    shortDesc: 'Phụt lửa phản lực cực mạnh (Space)',
    color: '#334155',
    accent: '#fb923c',
    mass: 1.1,
    hp: 110,
    thrust: 0.014,
    category: 'power'
  },
  cannon: {
    id: 'cannon',
    name: 'Pháo Xe Tăng',
    shortDesc: 'Nòng pháo xoay ngắm & bắn nổ (F / Chuột)',
    color: '#2d3a3a',
    accent: '#f87171',
    mass: 1.8,
    hp: 180,
    recoil: 0.012,
    category: 'weapon'
  }
};

const PARTS_ORDER = ['chassis', 'armor', 'wheel', 'thruster', 'cannon'];
