export interface Group {
    id: string;
    name: string;
    description?: string;
    created_at: string;
    updated_at: string;
}

export interface GroupCreate {
    name: string;
    description?: string;
}

export interface GroupUpdate {
    name?: string;
    description?: string;
}
