export const collection = (db: any, path: string) => {
  return { path };
};

export const query = (col: any, ...args: any[]) => {
  return { ...col, queryArgs: args };
};

export const orderBy = (field: string, direction: string = 'asc') => {
  return { type: 'orderBy', field, direction };
};

export const doc = (db: any, path: string, id?: string) => {
  return { path, id };
};

export const serverTimestamp = () => {
  return new Date();
};

// Outras funções que podem ser necessárias em outros componentes
export const addDoc = async (col: any, data: any) => {
  const res = await fetch(`/api/${col.path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  return { id: json.id };
};

export const updateDoc = async (docRef: any, data: any) => {
  const res = await fetch(`/api/${docRef.path}/${docRef.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return await res.json();
};

export const deleteDoc = async (docRef: any) => {
  const res = await fetch(`/api/${docRef.path}/${docRef.id}`, {
    method: 'DELETE',
  });
  return await res.json();
};
